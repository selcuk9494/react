import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StockService {
  constructor(private db: DatabaseService) {}

  private ensureFeatureAllowed(user: any, featureId: string) {
    if (!user) throw new ForbiddenException();
    if (user.is_admin) return;
    if (user.allowed_reports === null || typeof user.allowed_reports === 'undefined') return;
    if (Array.isArray(user.allowed_reports) && user.allowed_reports.includes(featureId))
      return;
    throw new ForbiddenException();
  }

  private async getClosingHour(branchId: string): Promise<number> {
    let closingHour = 6;
    try {
      const mainPool = this.db.getMainPool();
      const branchRes = await mainPool.query(
        'SELECT closing_hour FROM branches WHERE id = $1',
        [branchId],
      );
      if (branchRes.rows.length > 0) {
        const rawClosing = branchRes.rows[0].closing_hour;
        if (typeof rawClosing === 'number' && Number.isFinite(rawClosing)) {
          closingHour = rawClosing;
        } else if (typeof rawClosing === 'string') {
          const parsed = parseInt(rawClosing, 10);
          if (Number.isFinite(parsed)) closingHour = parsed;
        }
      }
    } catch (e: any) {
      const code = e?.code;
      if (code !== '42703') {
        console.error('getClosingHour error', e);
      }
    }
    return closingHour;
  }

  private async getCurrentBusinessDate(branchId: string): Promise<string> {
    const closingHour = await this.getClosingHour(branchId);

    // Türkiye saatini hesapla (UTC+3)
    const now = new Date();
    const turkeyOffset = 3 * 60;
    const utcOffset = now.getTimezoneOffset();
    const turkeyTime = new Date(
      now.getTime() + (utcOffset + turkeyOffset) * 60000,
    );

    const safeClosing = Math.min(23, Math.max(0, Math.floor(closingHour)));

    // Türkiye zamanındaki saat ve dakika
    const turkeyHour = turkeyTime.getUTCHours();
    const turkeyMinute = turkeyTime.getUTCMinutes();
    const currentTurkeyHourMinutes = turkeyHour * 60 + turkeyMinute;
    const closingHourMinutes = safeClosing * 60;

    // Türkiye zamanındaki yıl, ay, gün
    let turkeyYear = turkeyTime.getUTCFullYear();
    let turkeyMonth = turkeyTime.getUTCMonth();
    let turkeyDay = turkeyTime.getUTCDate();

    // Kapanış saatinden önceyse, iş günü dün
    if (currentTurkeyHourMinutes < closingHourMinutes) {
      // Bir gün geri git
      const yesterday = new Date(
        Date.UTC(turkeyYear, turkeyMonth, turkeyDay - 1),
      );
      turkeyYear = yesterday.getUTCFullYear();
      turkeyMonth = yesterday.getUTCMonth();
      turkeyDay = yesterday.getUTCDate();
    }

    const year = turkeyYear;
    const month = String(turkeyMonth + 1).padStart(2, '0');
    const day = String(turkeyDay).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private async getBusinessDayRange(branchId: string): Promise<{
    start: string;
    end: string;
    date: string;
    startDateOnly: string;
    endDateOnly: string;
  }> {
    const closingHour = await this.getClosingHour(branchId);

    // Türkiye saatini hesapla (UTC+3)
    const now = new Date();
    const turkeyOffset = 3 * 60; // dakika cinsinden
    const utcOffset = now.getTimezoneOffset();
    const turkeyTime = new Date(
      now.getTime() + (utcOffset + turkeyOffset) * 60000,
    );

    const safeClosing = Math.min(23, Math.max(0, Math.floor(closingHour)));

    // Türkiye zamanındaki bugünün yılı, ayı ve günü
    const turkeyYear = turkeyTime.getUTCFullYear();
    const turkeyMonth = turkeyTime.getUTCMonth();
    const turkeyDay = turkeyTime.getUTCDate();
    const turkeyHour = turkeyTime.getUTCHours();
    const turkeyMinute = turkeyTime.getUTCMinutes();

    // Bugünkü kapanış saatini Türkiye saatinde hesapla
    // Türkiye saati = UTC + 3 saat, yani UTC = Türkiye - 3 saat
    // Kapanış saati Türkiye'de safeClosing:00 olduğunda, UTC'de (safeClosing-3):00 olur
    const todayClosingUTC = Date.UTC(
      turkeyYear,
      turkeyMonth,
      turkeyDay,
      safeClosing - 3,
      0,
      0,
      0,
    );
    const todayClosing = new Date(todayClosingUTC);

    let startDate: Date;
    let endDate: Date;

    // Şu anki Türkiye saati kapanış saatinden önce mi sonra mı?
    const currentTurkeyHourMinutes = turkeyHour * 60 + turkeyMinute;
    const closingHourMinutes = safeClosing * 60;

    console.log(
      `[getBusinessDayRange] branchId=${branchId}, closingHour=${safeClosing}`,
    );
    console.log(
      `[getBusinessDayRange] Turkey time: ${turkeyYear}-${turkeyMonth + 1}-${turkeyDay} ${turkeyHour}:${turkeyMinute}`,
    );
    console.log(
      `[getBusinessDayRange] currentTurkeyHourMinutes=${currentTurkeyHourMinutes}, closingHourMinutes=${closingHourMinutes}`,
    );

    if (currentTurkeyHourMinutes < closingHourMinutes) {
      // Kapanış saatinden önce: devam eden iş günü dünden başladı
      endDate = todayClosing;
      startDate = new Date(todayClosing.getTime() - 24 * 60 * 60 * 1000);
      console.log(
        `[getBusinessDayRange] Before closing hour - using yesterday's business day`,
      );
    } else {
      // Kapanış saatinden sonra: yeni iş günü bugün başladı
      startDate = todayClosing;
      endDate = new Date(todayClosing.getTime() + 24 * 60 * 60 * 1000);
      console.log(
        `[getBusinessDayRange] After closing hour - using today's business day`,
      );
    }

    // Tarihleri Türkiye saatinde formatla
    const formatTurkeyDate = (d: Date) => {
      const turkeyD = new Date(d.getTime() + 3 * 60 * 60 * 1000);
      const y = turkeyD.getUTCFullYear();
      const m = String(turkeyD.getUTCMonth() + 1).padStart(2, '0');
      const day = String(turkeyD.getUTCDate()).padStart(2, '0');
      const h = String(turkeyD.getUTCHours()).padStart(2, '0');
      const min = String(turkeyD.getUTCMinutes()).padStart(2, '0');
      const s = String(turkeyD.getUTCSeconds()).padStart(2, '0');
      return `${y}-${m}-${day} ${h}:${min}:${s}`;
    };

    const formatTurkeyDateOnly = (d: Date) => {
      const turkeyD = new Date(d.getTime() + 3 * 60 * 60 * 1000);
      const y = turkeyD.getUTCFullYear();
      const m = String(turkeyD.getUTCMonth() + 1).padStart(2, '0');
      const day = String(turkeyD.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const dateLabel = formatTurkeyDateOnly(startDate);
    const start = formatTurkeyDate(startDate);
    const end = formatTurkeyDate(endDate);

    // Sadece tarih formatı (raptar gibi date alanları için)
    const startDateOnly = formatTurkeyDateOnly(startDate);
    const endDateOnly = formatTurkeyDateOnly(endDate);

    console.log(
      `[getBusinessDayRange] Result: start=${start}, end=${end}, date=${dateLabel}`,
    );
    console.log(
      `[getBusinessDayRange] Date only: startDateOnly=${startDateOnly}, endDateOnly=${endDateOnly}`,
    );

    return { start, end, date: dateLabel, startDateOnly, endDateOnly };
  }

  // Şube veritabanına bağlanmak için yardımcı fonksiyon
  private async getBranchPool(branchId: string) {
    const mainPool = this.db.getMainPool();
    const branchRes = await mainPool.query(
      'SELECT * FROM branches WHERE id = $1',
      [branchId],
    );

    if (branchRes.rows.length === 0) {
      throw new NotFoundException('Şube bulunamadı');
    }

    const branch = branchRes.rows[0];
    const pool = this.db.getBranchPool(branch);
    return { pool, branch };
  }

  async entryStock(
    branchId: string,
    items: { productName: string; quantity: number }[],
  ) {
    if (this.db.isMockMode()) {
      const date = await this.getCurrentBusinessDate(branchId);
      return { success: true, date, mock: true };
    }

    const { pool } = await this.getBranchPool(branchId);
    const date = await this.getCurrentBusinessDate(branchId);

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
            [item.productName, date],
          );

          if (existing.rows.length > 0) {
            // Güncelle
            await pool.query(
              `UPDATE daily_stock SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE product_name = $2 AND entry_date = $3`,
              [item.quantity, item.productName, date],
            );
          } else {
            // Yeni kayıt ekle
            await pool.query(
              `INSERT INTO daily_stock (product_name, quantity, entry_date) VALUES ($1, $2, $3)`,
              [item.productName, item.quantity, date],
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
      const { pool } = await this.getBranchPool(branchId);
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
        const date = await this.getCurrentBusinessDate(branchId);
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
          console.log(
            `Derived products from ads_adisyon: ${rows.length} items`,
          );
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
      } catch {
        groups = [...new Set(rows.map((r: any) => r.grup2).filter(Boolean))];
      }

      return rows;
    } catch (err) {
      console.error('GetProducts Error:', err);
      throw err;
    }
  }

  async getProductPrices(user: any, branchId: string) {
    this.ensureFeatureAllowed(user, 'product_prices');
    const { pool } = await this.getBranchPool(branchId);
    const date = await this.getCurrentBusinessDate(branchId);

    const plusRes = await pool.query(
      `SELECT DISTINCT plu FROM product_fiyat WHERE plu IS NOT NULL`,
    );
    const plus = (plusRes.rows || [])
      .map((r: any) => Number(r.plu))
      .filter((v: number) => Number.isFinite(v) && v > 0);
    if (plus.length === 0) return [];

    const metaByPlu = new Map<number, { urun_adi: string; grup2: string }>();

    const tryProductQueries: Array<{ sql: string; nameField: string; tipField: string }> =
      [
        { sql: 'SELECT plu, product_name as name, tip as tip FROM product', nameField: 'name', tipField: 'tip' },
        { sql: 'SELECT plu, urun_adi as name, tip as tip FROM product', nameField: 'name', tipField: 'tip' },
        { sql: 'SELECT plu, adi as name, tip as tip FROM product', nameField: 'name', tipField: 'tip' },
      ];

    let productTipByPlu: Map<number, number> | null = null;
    for (const q of tryProductQueries) {
      try {
        const res = await pool.query(q.sql);
        const rows = res.rows || [];
        if (rows.length === 0) continue;
        productTipByPlu = new Map<number, number>();
        for (const r of rows) {
          const plu = Number(r.plu);
          const name = String(r[q.nameField] || '').trim();
          const tip = Number(r[q.tipField]);
          if (!Number.isFinite(plu) || plu <= 0) continue;
          if (name) {
            metaByPlu.set(plu, { urun_adi: name, grup2: 'Diğer' });
          }
          if (Number.isFinite(tip)) productTipByPlu.set(plu, tip);
        }
        break;
      } catch {}
    }

    if (productTipByPlu && productTipByPlu.size > 0) {
      const tipSet = Array.from(new Set(Array.from(productTipByPlu.values())))
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v));
      if (tipSet.length > 0) {
        try {
          const grpRes = await pool.query(
            `SELECT id, adi FROM product_group WHERE id = ANY($1::int[])`,
            [tipSet],
          );
          const groupNameById = new Map<number, string>();
          for (const r of grpRes.rows || []) {
            const id = Number(r.id);
            const name = String(r.adi || '').trim();
            if (Number.isFinite(id) && name) groupNameById.set(id, name);
          }
          for (const [plu, tip] of productTipByPlu.entries()) {
            const g = groupNameById.get(tip);
            if (!g) continue;
            const prev = metaByPlu.get(plu);
            if (prev) metaByPlu.set(plu, { ...prev, grup2: g });
          }
        } catch {}
      }
    }

    const tryAdsQueries: Array<{ sql: string; nameField: string; groupField?: string }> = [
      {
        sql: `SELECT pluid as plu, MAX(product_name) as name FROM ads_adisyon WHERE kaptar >= $1::date - INTERVAL '90 days' GROUP BY pluid`,
        nameField: 'name',
      },
      {
        sql: `SELECT pluid as plu, MAX(urun_adi) as name FROM ads_adisyon WHERE kaptar >= $1::date - INTERVAL '90 days' GROUP BY pluid`,
        nameField: 'name',
      },
      {
        sql: `SELECT pluid as plu, MAX(urunadi) as name FROM ads_adisyon WHERE kaptar >= $1::date - INTERVAL '90 days' GROUP BY pluid`,
        nameField: 'name',
      },
      {
        sql: `SELECT pluid as plu, MAX(grup2) as grup2, MAX(product_name) as name FROM ads_adisyon WHERE kaptar >= $1::date - INTERVAL '90 days' GROUP BY pluid`,
        nameField: 'name',
        groupField: 'grup2',
      },
    ];

    for (const q of tryAdsQueries) {
      try {
        const res = await pool.query(q.sql, [date]);
        const rows = res.rows || [];
        if (rows.length === 0) continue;
        for (const r of rows) {
          const plu = Number(r.plu);
          if (!Number.isFinite(plu) || plu <= 0) continue;
          const name = String(r[q.nameField] || '').trim();
          const group = q.groupField ? String(r[q.groupField] || '').trim() : '';
          if (!metaByPlu.has(plu) && name) {
            metaByPlu.set(plu, { urun_adi: name, grup2: group || 'Diğer' });
          } else if (metaByPlu.has(plu) && group) {
            const prev = metaByPlu.get(plu)!;
            if (!prev.grup2 || prev.grup2 === 'Diğer') {
              metaByPlu.set(plu, { ...prev, grup2: group });
            }
          }
        }
        break;
      } catch {}
    }

    const chunk = <T,>(arr: T[], size: number) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const priceByPlu = new Map<number, { fiyat: number | null; onceki_fiyat: number | null }>();
    const priceQueryWithAltCols = `
      SELECT
        plu,
        MAX(CASE WHEN rn = 1 THEN fiyat END) as fiyat,
        MAX(CASE WHEN rn = 2 THEN fiyat END) as onceki_fiyat
      FROM (
        SELECT
          pf.plu,
          COALESCE(pf.fiyat, pf.fiyat_2, pf.fiyat_3) as fiyat,
          ROW_NUMBER() OVER (
            PARTITION BY pf.plu
            ORDER BY
              CASE
                WHEN (pf.bastar IS NULL OR pf.bastar <= CURRENT_DATE)
                 AND (pf.bittar IS NULL OR pf.bittar >= CURRENT_DATE)
                THEN 0
                ELSE 1
              END,
              COALESCE(pf.bastar, DATE '1900-01-01') DESC,
              COALESCE(pf.sirano, 0) DESC
          ) as rn
        FROM product_fiyat pf
        WHERE pf.plu = ANY($1::int[])
      ) x
      GROUP BY plu
    `;

    const priceQueryFiyatOnly = `
      SELECT
        plu,
        MAX(CASE WHEN rn = 1 THEN fiyat END) as fiyat,
        MAX(CASE WHEN rn = 2 THEN fiyat END) as onceki_fiyat
      FROM (
        SELECT
          pf.plu,
          pf.fiyat as fiyat,
          ROW_NUMBER() OVER (
            PARTITION BY pf.plu
            ORDER BY
              CASE
                WHEN (pf.bastar IS NULL OR pf.bastar <= CURRENT_DATE)
                 AND (pf.bittar IS NULL OR pf.bittar >= CURRENT_DATE)
                THEN 0
                ELSE 1
              END,
              COALESCE(pf.bastar, DATE '1900-01-01') DESC,
              COALESCE(pf.sirano, 0) DESC
          ) as rn
        FROM product_fiyat pf
        WHERE pf.plu = ANY($1::int[])
      ) x
      GROUP BY plu
    `;

    for (const part of chunk(plus, 2000)) {
      try {
        const res = await pool.query(priceQueryWithAltCols, [part]);
        for (const r of res.rows || []) {
          const plu = Number(r.plu);
          if (!Number.isFinite(plu) || plu <= 0) continue;
          const fiyat =
            r.fiyat !== null && typeof r.fiyat !== 'undefined'
              ? Number(r.fiyat)
              : null;
          const onceki =
            r.onceki_fiyat !== null && typeof r.onceki_fiyat !== 'undefined'
              ? Number(r.onceki_fiyat)
              : null;
          priceByPlu.set(plu, {
            fiyat: Number.isFinite(fiyat as any) ? (fiyat as any) : null,
            onceki_fiyat: Number.isFinite(onceki as any) ? (onceki as any) : null,
          });
        }
      } catch {
        const res = await pool.query(priceQueryFiyatOnly, [part]);
        for (const r of res.rows || []) {
          const plu = Number(r.plu);
          if (!Number.isFinite(plu) || plu <= 0) continue;
          const fiyat =
            r.fiyat !== null && typeof r.fiyat !== 'undefined'
              ? Number(r.fiyat)
              : null;
          const onceki =
            r.onceki_fiyat !== null && typeof r.onceki_fiyat !== 'undefined'
              ? Number(r.onceki_fiyat)
              : null;
          priceByPlu.set(plu, {
            fiyat: Number.isFinite(fiyat as any) ? (fiyat as any) : null,
            onceki_fiyat: Number.isFinite(onceki as any) ? (onceki as any) : null,
          });
        }
      }
    }

    const items = plus.map((plu) => {
      const meta = metaByPlu.get(plu);
      const prices = priceByPlu.get(plu);
      return {
        id: plu,
        urun_adi: meta?.urun_adi || String(plu),
        grup2: meta?.grup2 || 'Diğer',
        fiyat: prices?.fiyat ?? null,
        onceki_fiyat: prices?.onceki_fiyat ?? null,
      };
    });

    items.sort((a, b) => {
      const g = String(a.grup2 || '').localeCompare(String(b.grup2 || ''), 'tr');
      if (g !== 0) return g;
      return String(a.urun_adi || '').localeCompare(String(b.urun_adi || ''), 'tr');
    });

    return items;
  }

  async updateProductPrice(
    user: any,
    branchId: string,
    payload: { plu: number; fiyat: number },
  ) {
    this.ensureFeatureAllowed(user, 'product_prices');
    const { pool } = await this.getBranchPool(branchId);

    const plu = Number(payload?.plu);
    const fiyat = Number(payload?.fiyat);
    if (!Number.isFinite(plu) || plu <= 0) {
      throw new Error('Invalid product');
    }
    if (!Number.isFinite(fiyat) || fiyat < 0) {
      throw new Error('Invalid price');
    }

    const now = new Date();
    const turkeyOffset = 3 * 60;
    const utcOffset = now.getTimezoneOffset();
    const turkeyTime = new Date(now.getTime() + (utcOffset + turkeyOffset) * 60000);
    const y = turkeyTime.getUTCFullYear();
    const m = String(turkeyTime.getUTCMonth() + 1).padStart(2, '0');
    const tarih = `${y}${m}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE product_fiyat
        SET bittar = (CURRENT_DATE - INTERVAL '1 day')::date
        WHERE plu = $1
          AND (bittar IS NULL OR bittar >= CURRENT_DATE)
          AND (bastar IS NULL OR bastar <= CURRENT_DATE)
      `,
        [plu],
      );

      await client.query(
        `
        INSERT INTO product_fiyat (plu, tarih, id, fiyat, bastar, bittar)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, NULL)
      `,
        [plu, tarih, plu, fiyat],
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw e;
    } finally {
      client.release();
    }
  }

  async updateProductPricesBulk(
    user: any,
    branchId: string,
    payload: { items?: Array<{ plu: number; fiyat: number }> },
  ) {
    this.ensureFeatureAllowed(user, 'product_prices');
    const { pool } = await this.getBranchPool(branchId);

    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const normalized = rawItems
      .map((i) => ({ plu: Number((i as any)?.plu), fiyat: Number((i as any)?.fiyat) }))
      .filter((i) => Number.isFinite(i.plu) && i.plu > 0 && Number.isFinite(i.fiyat) && i.fiyat >= 0);

    const byPlu = new Map<number, number>();
    for (const i of normalized) {
      byPlu.set(i.plu, i.fiyat);
    }
    const items = Array.from(byPlu.entries()).map(([plu, fiyat]) => ({ plu, fiyat }));

    if (items.length === 0) return { success: true, updated: 0 };

    const now = new Date();
    const turkeyOffset = 3 * 60;
    const utcOffset = now.getTimezoneOffset();
    const turkeyTime = new Date(now.getTime() + (utcOffset + turkeyOffset) * 60000);
    const y = turkeyTime.getUTCFullYear();
    const m = String(turkeyTime.getUTCMonth() + 1).padStart(2, '0');
    const tarih = `${y}${m}`;

    const plus = items.map((i) => i.plu);
    const prices = items.map((i) => i.fiyat);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE product_fiyat
        SET bittar = (CURRENT_DATE - INTERVAL '1 day')::date
        WHERE plu = ANY($1::int[])
          AND (bittar IS NULL OR bittar >= CURRENT_DATE)
          AND (bastar IS NULL OR bastar <= CURRENT_DATE)
      `,
        [plus],
      );

      await client.query(
        `
        INSERT INTO product_fiyat (plu, tarih, id, fiyat, bastar, bittar)
        SELECT
          u.plu,
          $3,
          u.plu,
          u.fiyat,
          CURRENT_DATE,
          NULL
        FROM UNNEST($1::int[], $2::numeric[]) AS u(plu, fiyat)
      `,
        [plus, prices, tarih],
      );

      await client.query('COMMIT');
      return { success: true, updated: items.length };
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw e;
    } finally {
      client.release();
    }
  }

  // Canlı Stok Raporu - opsiyonel tarih parametresi ile
  async getLiveStock(branchId: string, selectedDate?: string) {
    const { pool } = await this.getBranchPool(branchId);

    let dateToUse: string;

    if (selectedDate) {
      // Kullanıcı tarih seçtiyse onu kullan
      dateToUse = selectedDate;
      console.log(`[getLiveStock] Using selected date: ${dateToUse}`);
    } else {
      // Varsayılan olarak bugünkü iş gününü kullan
      const { startDateOnly } = await this.getBusinessDayRange(branchId);
      dateToUse = startDateOnly;
      console.log(`[getLiveStock] Using business day: ${dateToUse}`);
    }

    console.log(`[getLiveStock] branchId=${branchId}, dateToUse=${dateToUse}`);

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

    // Stok girişi yapılan ürünleri al - seçilen tarih için
    let stockRes;
    try {
      stockRes = await pool.query(
        `
        SELECT d.product_name, d.quantity as initial_stock
        FROM daily_stock d
        WHERE d.entry_date = $1
      `,
        [dateToUse],
      );
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
      const initialStock = hasStockEntry
        ? stockEntryMap.get(product.product_name)
        : 0;

      stockMap.set(product.product_name, {
        name: product.product_name,
        group: product.group_name || 'Diğer',
        initial: initialStock,
        sold: 0,
        open: 0,
        cancelled: 0,
        remaining: initialStock,
        hasStockEntry: hasStockEntry, // Stok girişi yapıldı mı?
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
          hasStockEntry: true,
        });
      });
    }

    if (stockMap.size === 0) {
      return { date: dateToUse, items: [], hasAnyStockEntry: false };
    }

    // Satış verilerini al - kapalı adisyonlardan (ads_adisyon) - raptar (rapor tarihi) kullanarak
    // raptar date tipinde olduğu için sadece tarih karşılaştırması yapıyoruz
    let salesRes;
    try {
      // Önce tabloyu ve verileri kontrol et
      const checkQuery = await pool.query(`
        SELECT COUNT(*) as total, MIN(raptar) as min_date, MAX(raptar) as max_date 
        FROM ads_adisyon
      `);
      console.log('ads_adisyon table check (raptar):', checkQuery.rows[0]);

      // Seçilen tarih için kayıtları kontrol et - raptar alanı ile (sadece tarih karşılaştırması)
      const todayCheck = await pool.query(
        `
        SELECT COUNT(*) as today_count 
        FROM ads_adisyon 
        WHERE raptar = $1::date
      `,
        [dateToUse],
      );
      console.log(
        `Records for date ${dateToUse} (raptar):`,
        todayCheck.rows[0],
      );

      // raptar (rapor tarihi) ile sorgula - sadece o günün tarihi
      salesRes = await pool.query(
        `
        SELECT 
          COALESCE(p.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
          SUM(a.miktar) as total_qty
        FROM ads_adisyon a
        LEFT JOIN product p ON a.pluid = p.plu
        WHERE a.raptar = $1::date
          AND (a.sturu IS NULL OR a.sturu NOT IN (2, 4))
        GROUP BY COALESCE(p.product_name, CAST(a.pluid AS VARCHAR))
      `,
        [dateToUse],
      );
      console.log(
        `Sales query (raptar=${dateToUse}) returned ${salesRes.rows.length} rows:`,
        salesRes.rows.slice(0, 5),
      );
    } catch (err) {
      console.error('LiveStock sales query error:', err);
      salesRes = { rows: [] };
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
          hasStockEntry: false,
        });
      }
    });

    // Açık siparişleri al - ads_acik tablosundan - actar (açılış tarihi) kullanarak
    // actar date tipinde olduğu için sadece tarih karşılaştırması yapıyoruz
    let openRes;
    try {
      // Önce actar ve acsaat alanlarının varlığını kontrol et
      const checkOpen = await pool.query(`
        SELECT COUNT(*) as total, MIN(actar) as min_date, MAX(actar) as max_date 
        FROM ads_acik
      `);
      console.log('ads_acik table check (actar):', checkOpen.rows[0]);

      const todayOpenCheck = await pool.query(
        `
        SELECT COUNT(*) as today_count 
        FROM ads_acik 
        WHERE actar = $1::date
      `,
        [dateToUse],
      );
      console.log(
        `Open records for date ${dateToUse} (actar):`,
        todayOpenCheck.rows[0],
      );

      openRes = await pool.query(
        `
        SELECT 
          COALESCE(p.product_name, CAST(a.pluid AS VARCHAR)) as product_name, 
          SUM(a.miktar) as total_qty
        FROM ads_acik a
        LEFT JOIN product p ON a.pluid = p.plu
        WHERE (a.sturu IS NULL OR a.sturu NOT IN (2, 4))
          AND a.actar = $1::date
        GROUP BY COALESCE(p.product_name, CAST(a.pluid AS VARCHAR))
      `,
        [dateToUse],
      );
      console.log(
        `Open orders query (actar=${dateToUse}) returned ${openRes.rows.length} rows:`,
        openRes.rows.slice(0, 5),
      );
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
          hasStockEntry: false,
        });
      }
    });

    // Sonuçları diziye çevir ve sırala
    const result = Array.from(stockMap.values()).sort(
      (a, b) => b.sold + b.open - (a.sold + a.open),
    );
    const hasAnyStockEntry = result.some((item) => item.hasStockEntry);

    return {
      date: dateToUse,
      items: result,
      hasAnyStockEntry,
    };
  }

  async testDemoProducts() {
    try {
      const mainPool = this.db.getMainPool();
      const userRes = await mainPool.query(
        "SELECT id FROM users WHERE email = 'demo@micrapor.com'",
      );
      if (userRes.rows.length === 0) return { error: 'Demo user not found' };

      const userId = userRes.rows[0].id;
      const branchRes = await mainPool.query(
        'SELECT * FROM branches WHERE user_id = $1',
        [userId],
      );
      if (branchRes.rows.length === 0)
        return { error: 'Demo branch not found' };

      const branch = branchRes.rows[0];
      const pool = this.db.getBranchPool(branch);

      const client = await pool.connect();
      try {
        const res = await client.query('SELECT * FROM product');
        return {
          branch: branch.name,
          host: branch.db_host,
          product_count: res.rows.length,
          products: res.rows,
        };
      } finally {
        client.release();
      }
    } catch (error) {
      return { error: error.message, stack: error.stack };
    }
  }
}
