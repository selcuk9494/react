import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StockService {
  constructor(private db: DatabaseService) {}

  // Gün dönümü (06:00) mantığına göre bugünün tarihi - Türkiye saatine göre
  private getCurrentBusinessDate(): string {
    // Türkiye saat dilimi UTC+3
    const now = new Date();
    const turkeyOffset = 3 * 60; // dakika cinsinden
    const utcOffset = now.getTimezoneOffset(); // dakika cinsinden (negatif doğu için)
    const turkeyTime = new Date(now.getTime() + (utcOffset + turkeyOffset) * 60000);
    
    // Eğer saat 06:00'dan önceyse, iş günü bir önceki gündür
    if (turkeyTime.getHours() < 6) {
      turkeyTime.setDate(turkeyTime.getDate() - 1);
    }
    
    const year = turkeyTime.getFullYear();
    const month = String(turkeyTime.getMonth() + 1).padStart(2, '0');
    const day = String(turkeyTime.getDate()).padStart(2, '0');
    
    console.log(`Business date calculated: ${year}-${month}-${day} (Turkey time: ${turkeyTime.toISOString()})`);
    
    return `${year}-${month}-${day}`;
  }

  // Şube veritabanına bağlanmak için yardımcı fonksiyon
  private async getBranchPool(branchId: string) {
    const mainPool = this.db.getMainPool();
    const branchRes = await mainPool.query('SELECT * FROM branches WHERE id = $1', [branchId]);
    
    if (branchRes.rows.length === 0) {
      throw new NotFoundException('Şube bulunamadı');
    }
    
    const branch = branchRes.rows[0];
    return this.db.getBranchPool(branch);
  }

  async entryStock(branchId: string, items: { productName: string; quantity: number }[]) {
    const date = this.getCurrentBusinessDate();

    if (this.db.isMockMode()) {
      return { success: true, date, mock: true };
    }

    const pool = await this.getBranchPool(branchId);
    
    // Önce tablo var mı kontrol et, yoksa oluştur
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS daily_stock (
          id SERIAL PRIMARY KEY,
          product_name VARCHAR(255) NOT NULL,
          quantity INTEGER DEFAULT 0,
          entry_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_name, entry_date)
        )
      `);
    } catch (createErr) {
      console.log('Table check/create:', createErr);
    }
    
    try {
      for (const item of items) {
        try {
          // Önce mevcut kaydı kontrol et
          const existing = await pool.query(
            `SELECT id FROM daily_stock WHERE product_name = $1 AND entry_date = $2`,
            [item.productName, date]
          );
          
          if (existing.rows.length > 0) {
            // Güncelle
            await pool.query(
              `UPDATE daily_stock SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE product_name = $2 AND entry_date = $3`,
              [item.quantity, item.productName, date]
            );
          } else {
            // Yeni kayıt ekle
            await pool.query(
              `INSERT INTO daily_stock (product_name, quantity, entry_date) VALUES ($1, $2, $3)`,
              [item.productName, item.quantity, date]
            );
          }
        } catch (itemError) {
          console.error(`Error inserting item ${item.productName}:`, itemError);
          throw itemError;
        }
      }

      return { success: true, date };
    } catch (e) {
      console.error('Stock Entry Error:', e);
      throw e;
    }
  }

  // Ürün Listesini Getir (Stok Girişi İçin)
  async getProducts(branchId: string) {
    try {
      const pool = await this.getBranchPool(branchId);
      let rows: any[] = [];

      // 1. Önce tüm ürünleri product tablosundan çek (silindi filtresi olmadan)
      try {
        const res = await pool.query(`
          SELECT 
            p.plu as id,
            p.product_name AS urun_adi,
            COALESCE(pg.adi, 'Diğer') as grup2
          FROM product p
          LEFT JOIN product_group pg ON p.tip = pg.id
          ORDER BY pg.adi, p.product_name
        `);
        rows = res.rows || [];
        console.log(`Products query returned ${rows.length} items`);
      } catch (err) {
        console.error('Products query error:', err);
      }

      // 2. Eğer product tablosu boşsa veya hata varsa, ads_adisyon'dan türet
      if (!rows || rows.length === 0) {
        const date = this.getCurrentBusinessDate();
        try {
          const derived = await pool.query(
            `
            SELECT 
              COALESCE(p.plu, a.pluid) as id,
              COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)) as urun_adi,
              COALESCE(pg.adi, 'Diğer') as grup2
            FROM ads_adisyon a
            LEFT JOIN product p ON a.pluid = p.plu
            LEFT JOIN product_group pg ON p.tip = pg.id
            WHERE a.kaptar >= $1::date - INTERVAL '90 days'
            GROUP BY COALESCE(p.plu, a.pluid), COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)), COALESCE(pg.adi, 'Diğer')
            ORDER BY grup2, urun_adi
          `,
            [date],
          );
          rows = derived.rows.map((r: any) => ({
            id: r.id,
            urun_adi: r.urun_adi,
            grup2: r.grup2,
          }));
          console.log(`Derived products from ads_adisyon: ${rows.length} items`);
        } catch (err) {
          console.error('Products derived query error:', err);
        }
      }

      // 3. Grupları da ayrıca getir
      let groups: string[] = [];
      try {
        const groupRes = await pool.query(`
          SELECT DISTINCT adi as grup_adi 
          FROM product_group 
          WHERE adi IS NOT NULL AND adi != ''
          ORDER BY adi
        `);
        groups = groupRes.rows.map((r: any) => r.grup_adi);
        console.log(`Product groups: ${groups.length}`);
      } catch (err) {
        // Grupları ürünlerden çıkar
        groups = [...new Set(rows.map((r: any) => r.grup2).filter(Boolean))];
      }

      return rows;
    } catch (err) {
      console.error('GetProducts Error:', err);
      throw err;
    }
  }

  // Canlı Stok Raporu
  async getLiveStock(branchId: string) {
    const pool = await this.getBranchPool(branchId);
    const date = this.getCurrentBusinessDate();

    // Önce TÜM ürünleri al
    let allProducts: any[] = [];
    try {
      const productRes = await pool.query(`
        SELECT 
          p.plu as id,
          p.product_name,
          COALESCE(pg.adi, 'Diğer') as group_name
        FROM product p
        LEFT JOIN product_group pg ON p.tip = pg.id
        ORDER BY pg.adi, p.product_name
      `);
      allProducts = productRes.rows || [];
    } catch (err) {
      console.error('LiveStock products query error:', err);
    }

    // Stok girişi yapılan ürünleri al
    let stockRes;
    try {
      stockRes = await pool.query(`
        SELECT d.product_name, d.quantity as initial_stock
        FROM daily_stock d
        WHERE d.entry_date = $1
      `, [date]);
    } catch (err) {
      const code = (err as any)?.code;
      if (code === '42P01') {
        // Tablo yoksa boş döner
        stockRes = { rows: [] };
      } else {
        console.error('LiveStock stock query error:', err);
        stockRes = { rows: [] };
      }
    }

    // Stok girişi yapılanların map'i
    const stockEntryMap = new Map();
    stockRes.rows.forEach((row: any) => {
      stockEntryMap.set(row.product_name, row.initial_stock);
    });

    // Tüm ürünleri map'e ekle
    const stockMap = new Map();
    allProducts.forEach((product: any) => {
      const hasStockEntry = stockEntryMap.has(product.product_name);
      const initialStock = hasStockEntry ? stockEntryMap.get(product.product_name) : 0;
      
      stockMap.set(product.product_name, {
        name: product.product_name,
        group: product.group_name || 'Diğer',
        initial: initialStock,
        sold: 0,
        open: 0,
        cancelled: 0,
        remaining: initialStock,
        hasStockEntry: hasStockEntry  // Stok girişi yapıldı mı?
      });
    });

    // Eğer ürün tablosu boşsa, sadece stok girişi yapılanları göster
    if (stockMap.size === 0 && stockRes.rows.length > 0) {
      stockRes.rows.forEach((row: any) => {
        stockMap.set(row.product_name, {
          name: row.product_name,
          group: 'Diğer',
          initial: row.initial_stock,
          sold: 0,
          open: 0,
          cancelled: 0,
          remaining: row.initial_stock,
          hasStockEntry: true
        });
      });
    }

    if (stockMap.size === 0) {
      return { date, items: [], hasAnyStockEntry: false };
    }

    // Satış verilerini al - kapalı adisyonlardan (ads_adisyon)
    let salesRes;
    try {
      // kaptar (kapanış tarihi) ile sorgula - iş günü mantığına göre
      // Saat 06:00'dan önce ise önceki gün, sonra ise bugün
      salesRes = await pool.query(`
        SELECT 
          COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
          SUM(a.miktar) as total_qty, 
          a.sturu
        FROM ads_adisyon a
        LEFT JOIN product p ON a.pluid = p.plu
        WHERE DATE(a.kaptar) = $1::date
          AND a.sturu NOT IN (2, 4)
        GROUP BY COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)), a.sturu
      `, [date]);
      console.log(`Sales query (kaptar) returned ${salesRes.rows.length} rows for date ${date}`);
    } catch (err) {
      console.error('LiveStock sales query (kaptar) error:', err);
      // kaptar yoksa tarih ile dene
      try {
        salesRes = await pool.query(`
          SELECT 
            COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
            SUM(a.miktar) as total_qty, 
            a.sturu
          FROM ads_adisyon a
          LEFT JOIN product p ON a.pluid = p.plu
          WHERE DATE(a.tarih) = $1::date
            AND a.sturu NOT IN (2, 4)
          GROUP BY COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)), a.sturu
        `, [date]);
        console.log(`Sales query (tarih) returned ${salesRes.rows.length} rows for date ${date}`);
      } catch (err2) {
        console.error('LiveStock sales query (tarih) error:', err2);
        salesRes = { rows: [] };
      }
    }

    salesRes.rows.forEach((row: any) => {
      const productName = row.product_name;
      const item = stockMap.get(productName);
      const qty = Number(row.total_qty);
      
      if (item) {
        // Satılan olarak ekle (sturu 2=iade, 4=iptal hariç - zaten WHERE'de filtrelendi)
        item.sold += qty;
        item.remaining -= qty;
      } else {
        // Ürün stock map'te yok, yeni ekle
        stockMap.set(productName, {
          name: productName,
          group: 'Satılan',
          initial: 0,
          sold: qty,
          open: 0,
          cancelled: 0,
          remaining: -qty,
          hasStockEntry: false
        });
      }
    });

    // Açık siparişleri al - ads_acik tablosundan
    let openRes;
    try {
      openRes = await pool.query(`
        SELECT 
          COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
          SUM(a.miktar) as total_qty
        FROM ads_acik a
        LEFT JOIN product p ON a.pluid = p.plu
        WHERE DATE(a.tarih) = $1::date
          AND a.sturu NOT IN (2, 4)
        GROUP BY COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR))
      `, [date]);
      console.log(`Open orders query returned ${openRes.rows.length} rows for date ${date}`);
    } catch (err) {
      console.error('LiveStock open query error:', err);
      openRes = { rows: [] };
    }

    openRes.rows.forEach((row: any) => {
      const productName = row.product_name;
      const item = stockMap.get(productName);
      const qty = Number(row.total_qty);
      
      if (item) {
        item.open += qty;
        item.remaining -= qty;
      } else {
        // Ürün stock map'te yok, yeni ekle
        stockMap.set(productName, {
          name: productName,
          group: 'Açık Sipariş',
          initial: 0,
          sold: 0,
          open: qty,
          cancelled: 0,
          remaining: -qty,
          hasStockEntry: false
        });
      }
    });

    // Sonuçları diziye çevir ve sırala
    const result = Array.from(stockMap.values()).sort((a, b) => (b.sold + b.open) - (a.sold + a.open));
    const hasAnyStockEntry = result.some(item => item.hasStockEntry);

    return {
      date,
      items: result,
      hasAnyStockEntry
    };
  }

  async testDemoProducts() {
    try {
        const mainPool = this.db.getMainPool();
        const userRes = await mainPool.query("SELECT id FROM users WHERE email = 'demo@micrapor.com'");
        if (userRes.rows.length === 0) return { error: 'Demo user not found' };
        
        const userId = userRes.rows[0].id;
        const branchRes = await mainPool.query("SELECT * FROM branches WHERE user_id = $1", [userId]);
        if (branchRes.rows.length === 0) return { error: 'Demo branch not found' };
        
        const branch = branchRes.rows[0];
        const pool = this.db.getBranchPool(branch);
        
        const client = await pool.connect();
        try {
            const res = await client.query("SELECT * FROM product");
            return {
                branch: branch.name,
                host: branch.db_host,
                product_count: res.rows.length,
                products: res.rows
            };
        } finally {
            client.release();
        }
    } catch (error) {
        return { error: error.message, stack: error.stack };
    }
  }
}
