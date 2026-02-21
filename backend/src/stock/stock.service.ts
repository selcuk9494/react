import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StockService {
  constructor(private db: DatabaseService) {}

  // Gün dönümü (06:00) mantığına göre bugünün tarihi
  private getCurrentBusinessDate(): string {
    const now = new Date();
    // Eğer saat 06:00'dan önceyse, iş günü bir önceki gündür
    if (now.getHours() < 6) {
      now.setDate(now.getDate() - 1);
    }
    return now.toISOString().split('T')[0];
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
    
    try {
      for (const item of items) {
        try {
          await pool.query(
            `
            INSERT INTO daily_stock (product_name, quantity, entry_date)
            VALUES ($1, $2, $3)
            ON CONFLICT (product_name, entry_date) 
            DO UPDATE SET quantity = $2, updated_at = CURRENT_TIMESTAMP
            `,
            [item.productName, item.quantity, date],
          );
        } catch (itemError) {
          const code = (itemError as any)?.code;
          const message = (itemError as any)?.message || '';

          if (code === '42P01' || message.includes('daily_stock')) {
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

            await pool.query(
              `
              INSERT INTO daily_stock (product_name, quantity, entry_date)
              VALUES ($1, $2, $3)
              ON CONFLICT (product_name, entry_date) 
              DO UPDATE SET quantity = $2, updated_at = CURRENT_TIMESTAMP
              `,
              [item.productName, item.quantity, date],
            );
          } else {
            console.error(`Error inserting item ${item.productName}:`, itemError);
            throw itemError;
          }
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

      // Önce product tablosundan dene
      try {
        const res = await pool.query(`
          SELECT 
            p.plu as id,
            p.product_name AS urun_adi,
            COALESCE(pg.adi, p.grup2, 'Diğer') as grup2
          FROM product p
          LEFT JOIN product_group pg ON p.tip = pg.id
          WHERE p.silindi = false OR p.silindi IS NULL
          ORDER BY pg.adi, p.product_name
        `);
        rows = res.rows || [];
      } catch (err) {
        const code = (err as any)?.code;
        const message = ((err as any)?.message || '').toLowerCase();
        if (code !== '42P01' && code !== '42703' && !message.includes('silindi')) {
          console.error('Products query error:', err);
        }
      }

      // Eğer silindi sütunu yoksa, o sütun olmadan dene
      if (!rows || rows.length === 0) {
        try {
          const res = await pool.query(`
            SELECT 
              p.plu as id,
              p.product_name AS urun_adi,
              COALESCE(pg.adi, p.grup2, 'Diğer') as grup2
            FROM product p
            LEFT JOIN product_group pg ON p.tip = pg.id
            ORDER BY pg.adi, p.product_name
          `);
          rows = res.rows || [];
        } catch (err) {
          console.error('Products fallback query error:', err);
        }
      }

      // Eğer hala boşsa, son 60 gündeki satışlardan ürün listesi çıkar
      if (!rows || rows.length === 0) {
        const date = this.getCurrentBusinessDate();
        try {
          const derived = await pool.query(
            `
            SELECT 
              COALESCE(p.plu, a.pluid) as id,
              COALESCE(p.product_name, CAST(a.pluid AS VARCHAR)) as urun_adi,
              COALESCE(pg.adi, p.grup2, 'Diğer') as grup2
            FROM ads_adisyon a
            LEFT JOIN product p ON a.pluid = p.plu
            LEFT JOIN product_group pg ON p.tip = pg.id
            WHERE a.kaptar >= $1::date - INTERVAL '60 days'
            GROUP BY COALESCE(p.plu, a.pluid), COALESCE(p.product_name, CAST(a.pluid AS VARCHAR)), COALESCE(pg.adi, p.grup2, 'Diğer')
            ORDER BY grup2, urun_adi
          `,
            [date],
          );
          rows = derived.rows.map((r: any) => ({
            id: r.id,
            urun_adi: r.urun_adi,
            grup2: r.grup2,
          }));
        } catch (err) {
          console.error('Products derived query error:', err);
        }
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

    let stockRes;
    try {
      stockRes = await pool.query(`
        SELECT d.product_name, d.quantity as initial_stock, p.grup2 as group_name
        FROM daily_stock d
        LEFT JOIN product p ON d.product_name = p.product_name
        WHERE d.entry_date = $1
      `, [date]);
    } catch (err) {
      const code = (err as any)?.code;
      const message = ((err as any)?.message || '').toLowerCase();
      if (code === '42P01' || message.includes('relation') && message.includes('product')) {
        stockRes = await pool.query(`
          SELECT d.product_name, d.quantity as initial_stock, NULL as group_name
          FROM daily_stock d
          WHERE d.entry_date = $1
        `, [date]);
      } else {
        console.error('LiveStock stock query error:', err);
        throw err;
      }
    }

    // Stok girilen ürünlerin map'ini oluştur
    const stockMap = new Map();
    
    // Eğer stok girilmemişse bile, en azından girilenleri göster
    // Eğer hiç stok girilmemişse boş liste dönebiliriz veya tüm ürünleri 0 stokla gösterebiliriz.
    // Kullanıcı "Günlük stok miktarını girip kayıt yaptıktan sonra" dediği için, sadece girilenleri baz alıyoruz.
    
    stockRes.rows.forEach(row => {
      stockMap.set(row.product_name, {
        name: row.product_name,
        group: row.group_name || 'Diğer',
        initial: row.initial_stock,
        sold: 0,
        open: 0,
        cancelled: 0,
        remaining: row.initial_stock
      });
    });

    if (stockMap.size === 0) {
        return { date, items: [] };
    }

    let salesRes;
    try {
      salesRes = await pool.query(`
        SELECT 
          COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
          SUM(a.miktar) as total_qty, 
          a.sturu
        FROM ads_adisyon a
        LEFT JOIN product p ON a.pluid = p.id
        WHERE a.tarih = $1
        GROUP BY COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)), a.sturu
      `, [date]);
    } catch (err) {
      const code = (err as any)?.code;
      const message = ((err as any)?.message || '').toLowerCase();
      if (code === '42P01' || message.includes('relation') && message.includes('product')) {
        salesRes = await pool.query(`
          SELECT 
            COALESCE(a.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
            SUM(a.miktar) as total_qty, 
            a.sturu
          FROM ads_adisyon a
          WHERE a.tarih = $1
          GROUP BY COALESCE(a.product_name, CAST(a.pluid AS VARCHAR)), a.sturu
        `, [date]);
      } else {
        console.error('LiveStock sales query error:', err);
        throw err;
      }
    }

    salesRes.rows.forEach(row => {
      const item = stockMap.get(row.product_name);
      if (item) {
        const qty = Number(row.total_qty);
        if (row.sturu === 4) { // İptal
            item.cancelled += qty;
            // İptal stoktan düşmez (elimizde kalır)
        } else if (row.sturu === 2) { // İade
             // İade de stoktan düşmez
        } else {
            // Normal Satış
            item.sold += qty;
            item.remaining -= qty;
        }
      }
    });

    let openRes;
    try {
      openRes = await pool.query(`
        SELECT 
          COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
          SUM(a.miktar) as total_qty, 
          a.sturu
        FROM ads_acik a
        LEFT JOIN product p ON a.pluid = p.id
        WHERE a.tarih = $1
        GROUP BY COALESCE(p.product_name, a.product_name, CAST(a.pluid AS VARCHAR)), a.sturu
      `, [date]);
    } catch (err) {
      const code = (err as any)?.code;
      const message = ((err as any)?.message || '').toLowerCase();
      if (code === '42P01' || message.includes('relation') && message.includes('product')) {
        openRes = await pool.query(`
          SELECT 
            COALESCE(a.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
            SUM(a.miktar) as total_qty, 
            a.sturu
          FROM ads_acik a
          WHERE a.tarih = $1
          GROUP BY COALESCE(a.product_name, CAST(a.pluid AS VARCHAR)), a.sturu
        `, [date]);
      } else {
        console.error('LiveStock open query error:', err);
        throw err;
      }
    }

    openRes.rows.forEach(row => {
      const item = stockMap.get(row.product_name);
      if (item) {
        const qty = Number(row.total_qty);
        if (row.sturu !== 4) { 
            item.open += qty;
            item.remaining -= qty;
        }
      }
    });

    // Sonuçları diziye çevir ve sırala (Çok satılana göre)
    const result = Array.from(stockMap.values()).sort((a, b) => (b.sold + b.open) - (a.sold + a.open));

    return {
      date,
      items: result
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
