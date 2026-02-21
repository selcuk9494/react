import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, endOfMonth, parseISO, format } from 'date-fns';

@Injectable()
export class ReportsService {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
  ) {}

  private getDateRange(period: string, startDate?: string, endDate?: string) {
    const today = new Date();
    let start = startOfDay(today);
    let end = endOfDay(today);

    if (period === 'yesterday') {
      start = startOfDay(subDays(today, 1));
      end = endOfDay(subDays(today, 1));
    } else if (period === 'week') {
      start = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
      end = endOfDay(today);
    } else if (period === 'last7days') {
      start = startOfDay(subDays(today, 6));
      end = endOfDay(today);
    } else if (period === 'month') {
      start = startOfMonth(today);
      end = endOfDay(today);
    } else if (period === 'lastmonth') {
      const lastMonth = subDays(startOfMonth(today), 1);
      start = startOfMonth(lastMonth);
      end = endOfDay(lastMonth);
    } else if (period === 'custom' && startDate && endDate) {
      start = startOfDay(parseISO(startDate));
      end = endOfDay(parseISO(endDate));
    }

    return { start, end };
  }

  // Mock function to decrypt password (replace with actual decryption if needed)
  private decryptPassword(encrypted: string): string {
    return encrypted; 
  }

  private async getBranchPool(user: any) {
    const branchIndex = user.selected_branch || 0;
    const branch = user.branches[branchIndex];
    if (!branch) throw new Error('Invalid branch selection');

    // Collect kasa numbers: primary + any extras
    let kasa_nos: number[] = [];
    const primary = branch.kasa_no || 1;
    kasa_nos.push(primary);
    if (Array.isArray(branch.kasalar) && branch.kasalar.length > 0) {
      kasa_nos = Array.from(new Set([primary, ...branch.kasalar.filter((k: any) => typeof k === 'number')]));
    } else if (branch.id) {
      try {
        const mainPool = this.db.getMainPool();
        const rows = await this.db.executeQuery(mainPool, 'SELECT kasa_no FROM branch_kasas WHERE branch_id = $1', [branch.id]);
        const extras = rows.map((r: any) => parseInt(r.kasa_no)).filter((n: any) => !isNaN(n));
        kasa_nos = Array.from(new Set([primary, ...extras]));
      } catch (e) {}
    }

    return {
      pool: this.db.getBranchPool({
        db_host: branch.db_host,
        db_port: branch.db_port,
        db_name: branch.db_name,
        db_user: branch.db_user,
        db_password: this.decryptPassword(branch.db_password),
      }),
      kasa_no: primary,
      kasa_nos
    };
  }

  async getOrders(user: any, period: string, status: 'open' | 'closed', startDate?: string, endDate?: string, type?: 'adisyon' | 'paket') {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    let typeCondition = '';
    if (type === 'paket') {
        typeCondition = 'AND masano = 99999';
    } else if (type === 'adisyon') {
        typeCondition = 'AND masano != 99999';
    }

    if (status === 'open') {
        let query = `
            SELECT 
                a.adsno,
                SUM(COALESCE(a.tutar, 0)) as tutar,
                SUM(COALESCE(a.iskonto, 0)) as iskonto,
                MAX(COALESCE(a.masano, 0)) as masano,
                MAX(COALESCE(a.masano, 0)) as masa_no,
                MAX(a.acsaat) as acilis_saati,
                MAX(a.actar) as tarih,
                MAX(COALESCE(a.adtur, 0)) as adtur,
                MAX(a.kasa) as kasano,
                MAX(a.mustid) as mustid,
                MAX(CONCAT(COALESCE(m.adi, ''), ' ', COALESCE(m.soyadi, ''))) as customer_name
            FROM ads_acik a
            LEFT JOIN ads_musteri m ON a.mustid = m.mustid
            WHERE a.kasa = ANY($1) ${typeCondition}
        `;
        const params: any[] = [kasa_nos];
        if (period !== 'all') {
            query += ` AND DATE(a.actar) BETWEEN $2 AND $3`;
            params.push(dStart, dEnd);
        }
        query += `
            GROUP BY a.adsno
            ORDER BY a.adsno DESC
        `;
        let rows = await this.db.executeQuery(pool, query, params);
        if (!rows || rows.length === 0) {
            const fbQuery = `
                SELECT 
                    a.adsno,
                    SUM(COALESCE(a.tutar, 0)) as tutar,
                    MAX(COALESCE(a.masano, 0)) as masano,
                    MAX(COALESCE(a.masano, 0)) as masa_no,
                    MAX(a.acsaat) as acilis_saati,
                    MAX(a.actar) as tarih,
                    MAX(COALESCE(a.adtur, 0)) as adtur,
                    MAX(a.kasa) as kasano
                FROM ads_acik a
                WHERE a.kasa = ANY($1)
                GROUP BY a.adsno
                ORDER BY a.adsno DESC
                LIMIT 200
            `;
            rows = await this.db.executeQuery(pool, fbQuery, [kasa_nos]);
            if (!rows || rows.length === 0) {
                const fbSingleQuery = `
                    SELECT 
                        a.adsno,
                        SUM(COALESCE(a.tutar, 0)) as tutar,
                        MAX(COALESCE(a.masano, 0)) as masano,
                        MAX(COALESCE(a.masano, 0)) as masa_no,
                        MAX(a.acsaat) as acilis_saati,
                        MAX(a.actar) as tarih,
                        MAX(COALESCE(a.adtur, 0)) as adtur,
                        MAX(a.kasa) as kasano
                    FROM ads_acik a
                    WHERE a.kasa = $1
                    GROUP BY a.adsno
                    ORDER BY a.adsno DESC
                    LIMIT 200
                `;
                rows = await this.db.executeQuery(pool, fbSingleQuery, [kasa_no]);
            }
        }
        return rows;
    } else {
        let query = `
            WITH adisyon_agg AS (
                SELECT 
                    a.adsno,
                    COALESCE(a.adtur, 0) as adtur,
                    MAX(COALESCE(a.masano, 0)) as masano,
                    CAST(MAX(COALESCE(a.sipyer, 0)) AS INTEGER) as sipyer,
                    MAX(a.kaptar) as kaptar,
                    MAX(a.kapsaat) as kapanis_saati,
                    MAX(a.acsaat) as acilis_saati,
                    MAX(a.garsonno) as garsonno,
                    MAX(a.mustid) as mustid,
                    COALESCE(SUM(a.tutar), 0) as toplam_tutar_adisyon
                FROM ads_adisyon a
                WHERE a.kasa = ANY($1) ${typeCondition}
                GROUP BY a.adsno, COALESCE(a.adtur, 0)
            ),
            payment_agg AS (
                SELECT
                    o.adsno,
                    COALESCE(o.adtur, 0) as adtur,
                    MAX(o.raptar) as raptar,
                    COALESCE(SUM(o.otutar), 0) as toplam_tutar,
                    COALESCE(SUM(o.iskonto), 0) as toplam_iskonto,
                    MAX(o.mustid) as payment_mustid
                FROM ads_odeme o
                WHERE o.kasa = ANY($1)
                GROUP BY o.adsno, COALESCE(o.adtur, 0)
            )
            SELECT 
                a.adsno,
                a.toplam_tutar_adisyon as tutar,
                a.masano,
                a.masano as masa_no,
                a.adtur,
                a.sipyer,
                COALESCE(p.raptar, a.kaptar) as tarih,
                a.kapanis_saati,
                a.acilis_saati,
                per.adi as garson_adi,
                COALESCE(p.payment_mustid, a.mustid) as mustid,
                COALESCE(p.toplam_iskonto, 0) as iskonto,
                CONCAT(COALESCE(m.adi, ''), ' ', COALESCE(m.soyadi, '')) as customer_name
            FROM adisyon_agg a
            LEFT JOIN payment_agg p ON p.adsno = a.adsno AND p.adtur = a.adtur
            LEFT JOIN personel per ON a.garsonno = per.id
            LEFT JOIN ads_musteri m ON COALESCE(p.payment_mustid, a.mustid) = m.mustid
        `;
        const params: any[] = [kasa_nos];
        if (period !== 'all') {
            query += ` WHERE DATE(p.raptar) BETWEEN $2 AND $3`;
            params.push(dStart, dEnd);
        }
        query += `
            ORDER BY a.adsno DESC
        `;
        const rows = await this.db.executeQuery(pool, query, params);
        return rows;
    }
  }

  async getOrderDetails(user: any, adsno: string, status: 'open' | 'closed', date?: string, adtur?: number) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    let resolvedAdtur = typeof adtur !== 'undefined' ? adtur : undefined;
    if (typeof resolvedAdtur === 'undefined') {
      try {
        if (status === 'closed') {
          const r = await this.db.executeQuery(pool, `
            SELECT COALESCE(adtur, CASE WHEN masano = 99999 THEN 1 ELSE 0 END) AS adtur
            FROM ads_adisyon
            WHERE kasa = ANY($1) AND adsno = $2
            ORDER BY kaptar DESC, kapsaat DESC
            LIMIT 1
          `, [kasa_nos, adsno]);
          if (r && r[0] && typeof r[0].adtur !== 'undefined') resolvedAdtur = parseInt(r[0].adtur);
        } else {
          const r = await this.db.executeQuery(pool, `
            SELECT COALESCE(adtur, CASE WHEN sipyer = 2 OR masano = 99999 THEN 1 ELSE 0 END) AS adtur
            FROM ads_acik
            WHERE kasa = ANY($1) AND adsno = $2
            ORDER BY actar DESC, acsaat DESC
            LIMIT 1
          `, [kasa_nos, adsno]);
          if (r && r[0] && typeof r[0].adtur !== 'undefined') resolvedAdtur = parseInt(r[0].adtur);
        }
      } catch (e) {}
    }

    if (status === 'open') {
        const query = `
            WITH order_info AS (
                SELECT 
                    adsno,
                    MAX(COALESCE(adtur, 0)) as adtur,
                    MAX(COALESCE(masano, 0)) as masano,
                    MAX(CAST(COALESCE(sipyer, 0) AS INTEGER)) as sipyer,
                    MAX(garsonno) as garsonno,
                    MAX(mustid) as mustid,
                    MAX(actar) as tarih,
                    MAX(acsaat) as acilis_saati,
                    COALESCE(SUM(iskonto), 0) as toplam_iskonto,
                    COALESCE(SUM(tutar), 0) as toplam_tutar
                FROM ads_acik
                WHERE kasa = ANY($1) AND adsno = $2 ${typeof resolvedAdtur !== 'undefined' ? 'AND adtur = $3' : ''}
                GROUP BY adsno
            ),
            order_items AS (
                SELECT 
                    a.adsno,
                    MAX(COALESCE(a.adtur, 0)) as adtur,
                    json_agg(
                        json_build_object(
                            'product_name', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                            'urun_adi', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                            'quantity', COALESCE(a.miktar, 1),
                            'miktar', COALESCE(a.miktar, 1),
                            'price', COALESCE(a.bfiyat, 0),
                            'birim_fiyat', COALESCE(a.bfiyat, 0),
                            'total', COALESCE(a.tutar, 0),
                            'toplam', COALESCE(a.tutar, 0),
                            'ack1', a.ack1,
                            'ack2', a.ack2,
                            'ack3', a.ack3,
                            'sturu', COALESCE(a.sturu, 0),
                            'pluid', a.pluid
                        )
                        ORDER BY a.actar, a.acsaat
                    ) as items
                FROM ads_acik a
                LEFT JOIN product pr ON a.pluid = pr.plu
                WHERE a.kasa = ANY($1) AND a.adsno = $2 ${typeof resolvedAdtur !== 'undefined' ? 'AND a.adtur = $3' : ''} AND a.pluid IS NOT NULL
                GROUP BY a.adsno
            )
            SELECT
                oi.adsno,
                oi.adtur,
                oi.masano,
                oi.masano as masa_no,
                oi.sipyer,
                CASE 
                  WHEN oi.sipyer = 1 THEN 'Hızlı Satış'
                  WHEN oi.sipyer = 2 THEN 'Paket'
                  WHEN oi.sipyer = 3 THEN 'Adisyon'
                  ELSE 'Diğer'
                END as sipyer_name,
                p.adi as garson,
                m.adi as customer_name,
                oi.mustid,
                oi.tarih,
                oi.acilis_saati,
                NULL as kapanis_saati,
                oi.toplam_iskonto,
                oi.toplam_tutar,
                od.odmname as payment_name,
                COALESCE(items.items, '[]'::json) as items
            FROM order_info oi
            LEFT JOIN personel p ON oi.garsonno = p.id
            LEFT JOIN ads_musteri m ON oi.mustid = m.mustid
            LEFT JOIN ads_odeme o ON o.adsno = oi.adsno AND o.kasa = ANY($1) ${typeof resolvedAdtur !== 'undefined' ? 'AND o.adtur = $3' : ''}
            LEFT JOIN ads_odmsekli od ON o.otip = od.odmno
            LEFT JOIN order_items items ON items.adsno = oi.adsno
        `;
        const params = typeof resolvedAdtur !== 'undefined' ? [kasa_nos, adsno, resolvedAdtur] : [kasa_nos, adsno];
        const rows = await this.db.executeQuery(pool, query, params);
        return rows[0] || null;
    } else {
        const query = `
            WITH order_info AS (
                SELECT 
                    adsno,
                    MAX(COALESCE(adtur, 0)) as adtur,
                    MAX(COALESCE(masano, 0)) as masano,
                    MAX(CAST(COALESCE(sipyer, 0) AS INTEGER)) as sipyer,
                    MAX(garsonno) as garsonno,
                    MAX(mustid) as mustid,
                    MAX(acsaat) as acilis_saati,
                    MAX(kapsaat) as kapanis_saati
                FROM ads_adisyon
                WHERE kasa = ANY($1) AND adsno = $2 ${typeof resolvedAdtur !== 'undefined' ? 'AND adtur = $3' : ''}
                GROUP BY adsno
            ),
            order_items AS (
                SELECT 
                    a.adsno,
                    json_agg(
                        json_build_object(
                            'product_name', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                            'urun_adi', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                            'quantity', COALESCE(a.miktar, 1),
                            'miktar', COALESCE(a.miktar, 1),
                            'price', COALESCE(a.bfiyat, 0),
                            'birim_fiyat', COALESCE(a.bfiyat, 0),
                            'total', COALESCE(a.tutar, 0),
                            'toplam', COALESCE(a.tutar, 0),
                            'ack1', a.ack1,
                            'ack2', a.ack2,
                            'ack3', a.ack3,
                            'sturu', COALESCE(a.sturu, 0),
                            'pluid', a.pluid
                        )
                        ORDER BY a.kaptar, a.kapsaat
                    ) as items
                FROM ads_adisyon a
                LEFT JOIN product pr ON a.pluid = pr.plu
                WHERE a.kasa = ANY($1) AND a.adsno = $2 ${typeof resolvedAdtur !== 'undefined' ? 'AND a.adtur = $3' : ''} AND a.pluid IS NOT NULL
                GROUP BY a.adsno
            ),
            payment_info AS (
                SELECT
                    adsno,
                    MAX(raptar) as tarih,
                    COALESCE(SUM(iskonto), 0) as toplam_iskonto,
                    COALESCE(SUM(otutar), 0) as toplam_tutar,
                    MAX(mustid) as payment_mustid
                FROM ads_odeme
                WHERE kasa = ANY($1) AND adsno = $2 ${typeof resolvedAdtur !== 'undefined' ? 'AND adtur = $3' : ''}
                GROUP BY adsno
            )
            SELECT
                oi.adsno,
                oi.adtur,
                oi.masano,
                oi.masano as masa_no,
                oi.sipyer,
                CASE 
                  WHEN oi.sipyer = 1 THEN 'Hızlı Satış'
                  WHEN oi.sipyer = 2 THEN 'Paket'
                  WHEN oi.sipyer = 3 THEN 'Adisyon'
                  ELSE 'Diğer'
                END as sipyer_name,
                p.adi as garson,
                m.adi as customer_name,
                COALESCE(oi.mustid, pi.payment_mustid) as mustid,
                COALESCE(pi.tarih, CURRENT_DATE) as tarih,
                oi.acilis_saati,
                oi.kapanis_saati,
                COALESCE(pi.toplam_iskonto, 0) as toplam_iskonto,
                COALESCE(pi.toplam_tutar, 0) as toplam_tutar,
                od.odmname as payment_name,
                COALESCE(items.items, '[]'::json) as items
            FROM order_info oi
            LEFT JOIN personel p ON oi.garsonno = p.id
            LEFT JOIN ads_musteri m ON COALESCE(oi.mustid, 0) = m.mustid
            LEFT JOIN payment_info pi ON pi.adsno = oi.adsno
            LEFT JOIN ads_odeme o ON o.adsno = oi.adsno AND o.kasa = ANY($1) ${typeof resolvedAdtur !== 'undefined' ? 'AND o.adtur = $3' : ''}
            LEFT JOIN ads_odmsekli od ON o.otip = od.odmno
            LEFT JOIN order_items items ON items.adsno = oi.adsno
            LIMIT 1
        `;
        const rows = await this.db.executeQuery(pool, query, typeof resolvedAdtur !== 'undefined' ? [kasa_nos, adsno, resolvedAdtur] : [kasa_nos, adsno]);
        return rows[0] || null;
    }
  }

  async debugOrderCheck(user: any, adsno: string) {
    const { pool, kasa_nos } = await this.getBranchPool(user);
    const openCountQuery = `SELECT COUNT(*)::int as count FROM ads_acik WHERE adsno = $2 AND kasa = ANY($1)`;
    const closedCountQuery = `SELECT COUNT(*)::int as count FROM ads_adisyon WHERE adsno = $2 AND kasa = ANY($1)`;
    const openItemsQuery = `
      SELECT a.pluid, a.miktar, a.bfiyat, a.tutar, a.sturu, a.ack1, a.actar, a.acsaat
      FROM ads_acik a
      WHERE a.adsno = $2 AND a.kasa = ANY($1)
      ORDER BY a.actar DESC
      LIMIT 5
    `;
    const closedItemsQuery = `
      SELECT a.pluid, a.miktar, a.bfiyat, a.tutar, a.sturu, a.ack1, a.kaptar, a.kapsaat
      FROM ads_adisyon a
      WHERE a.adsno = $2 AND a.kasa = ANY($1)
      ORDER BY a.kaptar DESC
      LIMIT 5
    `;
    const openCount = await this.db.executeQuery(pool, openCountQuery, [kasa_nos, adsno]);
    const closedCount = await this.db.executeQuery(pool, closedCountQuery, [kasa_nos, adsno]);
    const openItems = await this.db.executeQuery(pool, openItemsQuery, [kasa_nos, adsno]);
    const closedItems = await this.db.executeQuery(pool, closedItemsQuery, [kasa_nos, adsno]);
    return {
      adsno,
      kasa_nos,
      open: {
        count: openCount[0]?.count ?? 0,
        sample_items: openItems,
      },
      closed: {
        count: closedCount[0]?.count ?? 0,
        sample_items: closedItems,
      },
    };
  }

  async getCustomerById(user: any, id: number) {
    const { pool } = await this.getBranchPool(user);
    const q = `
      SELECT id, adi, COALESCE(soyadi, '') as soyadi
      FROM ads_musteri
      WHERE id = $1
      LIMIT 1
    `;
    const rows = await this.db.executeQuery(pool, q, [id]);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      first_name: r.adi,
      last_name: r.soyadi,
      full_name: `${r.adi}${r.soyadi ? ' ' + r.soyadi : ''}`,
    };
  }

  private async hasColumn(pool: any, table: string, column: string): Promise<boolean> {
    const rows = await this.db.executeQuery(
      pool,
      `
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
      LIMIT 1
    `,
      [table, column],
    );
    return rows && rows.length > 0;
  }

  async getDashboard(user: any, period: string, startDate?: string, endDate?: string) {
    const cacheKey = this.cache.generateKey('dashboard_v2', user.id, period, startDate || 'none', endDate || 'none', user.selected_branch || 0);
    const cacheTTL = ['today', 'yesterday'].includes(period) ? 120 : 600;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = {
      acik_adisyon_toplam: 0,
      kapali_adisyon_toplam: 0,
      kapali_iskonto_toplam: 0,
      iptal_toplam: 0,
      borca_atilan_toplam: 0,
      borca_atilan_adet: 0,
      acik_adisyon_adet: 0,
      kapali_adisyon_adet: 0,
      iptal_adet: 0,
      dagilim: {
        paket: {
          acik_adet: 0,
          acik_toplam: 0,
          kapali_adet: 0,
          kapali_toplam: 0,
          kapali_iskonto: 0,
          toplam_adet: 0,
          toplam_tutar: 0,
          acik_yuzde: 0,
          kapali_yuzde: 0,
        },
        adisyon: {
          acik_adet: 0,
          acik_toplam: 0,
          kapali_adet: 0,
          kapali_toplam: 0,
          kapali_iskonto: 0,
          toplam_adet: 0,
          toplam_tutar: 0,
          acik_yuzde: 0,
          kapali_yuzde: 0,
        },
        hizli: {
          acik_adet: 0,
          acik_toplam: 0,
          kapali_adet: 0,
          kapali_toplam: 0,
          kapali_iskonto: 0,
          toplam_adet: 0,
          toplam_tutar: 0,
          kapali_yuzde: 0,
        },
      },
    };

    try {
      const [openOrders, closedOrders, performance, debts, cancelledItems] = await Promise.all([
        this.getOrders(user, period, 'open', startDate, endDate).catch(() => []),
        this.getOrders(user, period, 'closed', startDate, endDate).catch(() => []),
        this.getPerformance(user, period, startDate, endDate).catch(() => null),
        this.getDebts(user, period, startDate, endDate).catch(() => []),
        this.getCancelledItems(user, period, startDate, endDate).catch(() => []),
      ]);

      const mapSipyer = (sip: number) => {
        if (sip === 1) return 'hizli';
        if (sip === 2) return 'paket';
        if (sip === 3) return 'adisyon';
        return 'adisyon';
      };

      let totalOpenAmount = 0;
      let totalClosedAmount = 0;

      (openOrders as any[]).forEach((o) => {
        const key = mapSipyer(o.sipyer);
        const tutar = Number(o.tutar) || 0;
        result.acik_adisyon_toplam += tutar;
        result.acik_adisyon_adet += 1;
        const g = (result.dagilim as any)[key];
        if (g) {
          g.acik_adet += 1;
          g.acik_toplam += tutar;
        }
        totalOpenAmount += tutar;
      });

      (closedOrders as any[]).forEach((o) => {
        const key = mapSipyer(o.sipyer);
        const tutar = Number(o.tutar) || 0;
        result.kapali_adisyon_toplam += tutar;
        result.kapali_adisyon_adet += 1;
        const g = (result.dagilim as any)[key];
        if (g) {
          g.kapali_adet += 1;
          g.kapali_toplam += tutar;
        }
        totalClosedAmount += tutar;
      });

      if (performance && (performance as any).summary) {
        const summary = (performance as any).summary;
        if (typeof summary.total_sales === 'number') {
          result.kapali_adisyon_toplam = summary.total_sales;
        }
        if (typeof summary.total_orders === 'number') {
          result.kapali_adisyon_adet = summary.total_orders;
        }
        if (typeof summary.total_discount === 'number') {
          result.kapali_iskonto_toplam = summary.total_discount;
        }
      }

      const totalSales = result.kapali_adisyon_toplam || totalClosedAmount || 0;

      (['adisyon', 'paket', 'hizli'] as const).forEach((key) => {
        const g = (result.dagilim as any)[key];
        g.toplam_adet = g.acik_adet + g.kapali_adet;
        g.toplam_tutar = g.acik_toplam + g.kapali_toplam;
        if (totalSales > 0 && result.kapali_iskonto_toplam > 0 && g.kapali_toplam > 0) {
          const share = g.kapali_toplam / totalSales;
          g.kapali_iskonto = Number((result.kapali_iskonto_toplam * share).toFixed(2));
        }
      });

      const totalOpen = result.acik_adisyon_toplam || totalOpenAmount || 0;
      const totalClosed = totalSales || totalClosedAmount || 0;

      (['adisyon', 'paket'] as const).forEach((key) => {
        const g = (result.dagilim as any)[key];
        g.acik_yuzde =
          totalOpen > 0 && g.acik_toplam > 0
            ? Math.round((g.acik_toplam / totalOpen) * 100)
            : 0;
      });

      (['adisyon', 'paket', 'hizli'] as const).forEach((key) => {
        const g = (result.dagilim as any)[key];
        g.kapali_yuzde =
          totalClosed > 0 && g.kapali_toplam > 0
            ? Math.round((g.kapali_toplam / totalClosed) * 100)
            : 0;
      });

      (debts as any[]).forEach((d) => {
        const borc = Number(d.borc) || 0;
        if (borc > 0) {
          result.borca_atilan_toplam += borc;
          result.borca_atilan_adet += 1;
        }
      });

      (cancelledItems as any[]).forEach((c) => {
        if (c.type === 'iptal') {
          const tutar = Number(c.tutar) || 0;
          result.iptal_toplam += tutar;
          result.iptal_adet += 1;
        }
      });
    } catch (e) {}

    await this.cache.set(cacheKey, result, cacheTTL);
    return result;
  }


  async getSalesChart(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    const baseQuery = `
      SELECT 
          DATE(kaptar) as tarih,
          SUM(COALESCE(tutar, 0)) as toplam
      FROM ads_adisyon
      WHERE kaptar BETWEEN $1 AND $2
    `;

    const primaryQuery = `
      ${baseQuery} AND kasa = ANY($3)
      GROUP BY DATE(kaptar)
      ORDER BY DATE(kaptar)
    `;

    let rows = await this.db.executeQuery(pool, primaryQuery, [dStart, dEnd, kasa_nos]);

    if (!rows || rows.length === 0) {
      const fallbackQuery = `
        ${baseQuery}
        GROUP BY DATE(kaptar)
        ORDER BY DATE(kaptar)
      `;
      rows = await this.db.executeQuery(pool, fallbackQuery, [dStart, dEnd]);
    }

    return rows.map(row => ({
      tarih: format(row.tarih, 'yyyy-MM-dd'),
      toplam: parseFloat(row.toplam)
    }));
  }

  async getPaymentTypes(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    const query = `
      SELECT 
          COALESCE(od.odmname, 'Tanımsız') as payment_name,
          COALESCE(SUM(o.otutar), 0) as total,
          COUNT(DISTINCT o.adsno) as count,
          COALESCE(od.odmno, NULL) as otip
      FROM ads_odeme o
      LEFT JOIN ads_odmsekli od ON o.otip = od.odmno
      WHERE DATE(o.raptar) BETWEEN $1 AND $2 AND o.kasa = ANY($3)
      GROUP BY od.odmno, od.odmname
      ORDER BY total DESC
    `;
    
    const rows = await this.db.executeQuery(pool, query, [dStart, dEnd, kasa_nos]);
    return rows.map(row => ({
      payment_name: row.payment_name,
      total: parseFloat(row.total),
      count: parseInt(row.count),
      otip: row.otip
    }));
  }

  async getCourierTracking(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');
    
    const openQuery = `
      SELECT DISTINCT
          a.adsno,
          per.adi as kurye,
          a.gidsaat as cikis,
          a.donsaat as donus,
          a.actar as tarih,
          'open' as status
      FROM ads_acik a
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.kasa = ANY($1::int[])
        AND (COALESCE(a.adtur, 0) = 1 OR a.masano = 99999)
        AND DATE(a.actar) BETWEEN $2 AND $3
    `;
    const openRows = await this.db.executeQuery(pool, openQuery, [kasa_nos, dStart, dEnd]);
    
    const closedQuery = `
      SELECT DISTINCT
          a.adsno,
          per.adi as kurye,
          a.motcikis as cikis,
          a.stopsaat as donus,
          COALESCE(a.stoptar, a.siptar) as tarih,
          a.sipsaat as sipsaat,
          a.stoptar as stoptar,
          'closed' as status
      FROM ads_adisyon a
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.kasa = ANY($1::int[])
        AND (COALESCE(a.adtur, 0) = 1 OR a.masano = 99999)
        AND (DATE(a.siptar) BETWEEN $2 AND $3 OR DATE(a.stoptar) BETWEEN $2 AND $3)
    `;
    const closedRows = await this.db.executeQuery(pool, closedQuery, [kasa_nos, dStart, dEnd]);
    
    const results = [...openRows, ...closedRows];
    results.sort((a, b) => {
      const da = new Date(a.tarih);
      const db = new Date(b.tarih);
      return db.getTime() - da.getTime();
    });
    if (results.length > 0) return results;

    const fbOpenQuery = `
      SELECT DISTINCT
          a.adsno,
          per.adi as kurye,
          a.gidsaat as cikis,
          a.donsaat as donus,
          a.actar as tarih,
          'open' as status
      FROM ads_acik a
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.kasa = ANY($1::int[])
        AND (COALESCE(a.adtur, 0) = 1 OR a.masano = 99999)
      ORDER BY a.actar DESC
      LIMIT 100
    `;
    const fbClosedQuery = `
      SELECT DISTINCT
          a.adsno,
          per.adi as kurye,
          a.motcikis as cikis,
          a.stopsaat as donus,
          COALESCE(a.stoptar, a.siptar) as tarih,
          a.sipsaat as sipsaat,
          a.stoptar as stoptar,
          'closed' as status
      FROM ads_adisyon a
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.kasa = ANY($1::int[])
        AND (COALESCE(a.adtur, 0) = 1 OR a.masano = 99999)
      ORDER BY COALESCE(a.stoptar, a.siptar) DESC
      LIMIT 100
    `;
    const fbOpen = await this.db.executeQuery(pool, fbOpenQuery, [kasa_nos]);
    const fbClosed = await this.db.executeQuery(pool, fbClosedQuery, [kasa_nos]);
    const fbRes = [...fbOpen, ...fbClosed];
    fbRes.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
    return fbRes;
  }

  async getCancelledItems(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    // Open
    const openQuery = `
      SELECT 
          COALESCE(p.product_name, CAST(a.pluid AS VARCHAR), 'Ürün') as product_name,
          COALESCE(a.miktar, 0) as quantity,
          a.ack1 as reason,
          a.actar as date,
          a.adsno as order_id,
          a.adtur as adtur,
          per.adi as waiter_name,
          CASE a.sturu WHEN 1 THEN 'ikram' WHEN 2 THEN 'iade' WHEN 4 THEN 'iptal' ELSE 'diğer' END as type,
          'open' as status
      FROM ads_acik a
      LEFT JOIN product p ON a.pluid = p.plu
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.actar BETWEEN $1 AND $2 AND a.kasa = ANY($3) AND a.sturu IN (1,2,4)
    `;
    const openRows = await this.db.executeQuery(pool, openQuery, [dStart, dEnd, kasa_nos]);

    // Closed
    const closedQuery = `
      SELECT 
          COALESCE(p.product_name, CAST(a.pluid AS VARCHAR), 'Ürün') as product_name,
          COALESCE(a.miktar, 0) as quantity,
          a.ack1 as reason,
          a.kaptar as date,
          a.adsno as order_id,
          a.adtur as adtur,
          per.adi as waiter_name,
          CASE a.sturu WHEN 1 THEN 'ikram' WHEN 2 THEN 'iade' WHEN 4 THEN 'iptal' ELSE 'diğer' END as type,
          'closed' as status
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = ANY($3) AND a.sturu IN (1,2,4)
    `;
    const closedRows = await this.db.executeQuery(pool, closedQuery, [dStart, dEnd, kasa_nos]);

    const results = [...openRows, ...closedRows];
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return results.slice(0, 200);
  }

  async getUnsoldCancels(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');
    const query = `
      SELECT 
        COALESCE(a.urun_adi, 'Ürün') as urun_adi,
        a.tarih_saat,
        a.pers_id,
        per.adi as personel_adi,
        COALESCE(a.miktar, 0) as miktar,
        COALESCE(a.tutar, 0) as tutar
      FROM ads_iptal a
      LEFT JOIN personel per ON a.pers_id = per.id
      WHERE DATE(a.tarih_saat) BETWEEN $1 AND $2
      ORDER BY a.tarih_saat DESC
    `;
    const rows = await this.db.executeQuery(pool, query, [dStart, dEnd]);
    return rows.map((r: any) => ({
      urun_adi: r.urun_adi,
      tarih: format(r.tarih_saat, 'yyyy-MM-dd'),
      saat: format(r.tarih_saat, 'HH:mm'),
      pers_id: r.pers_id,
      personel_adi: r.personel_adi,
      miktar: parseFloat(r.miktar),
      tutar: parseFloat(r.tutar)
    }));
  }

  async getPerformance(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    // Totals
    const totalsQuery = `
      SELECT 
          COALESCE(SUM(o.otutar), 0) as total_sales,
          COUNT(DISTINCT o.adsno) as orders_count,
          COALESCE(SUM(o.iskonto), 0) as total_discount
      FROM ads_odeme o
      WHERE DATE(o.raptar) BETWEEN $1 AND $2 AND o.kasa = ANY($3)
    `;
    const totalsRows = await this.db.executeQuery(pool, totalsQuery, [dStart, dEnd, kasa_nos]);
    const totals = totalsRows[0] || { total_sales: 0, orders_count: 0, total_discount: 0 };
    const avg_ticket = parseFloat(totals.total_sales) / Math.max(1, parseInt(totals.orders_count));

    // Duration
    const durationQuery = `
      SELECT 
          a.adsno,
          MAX(a.acsaat) as acilis_saati,
          MAX(a.kapsaat) as kapanis_saati,
          MAX(a.kaptar) as tarih
      FROM ads_adisyon a
      WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = ANY($3)
      GROUP BY a.adsno
    `;
    const durations = await this.db.executeQuery(pool, durationQuery, [dStart, dEnd, kasa_nos]);
    
    let totalMinutes = 0;
    let over60 = 0;
    
    durations.forEach(row => {
        try {
            if (row.acilis_saati && row.kapanis_saati) {
                const s = row.acilis_saati.split(':');
                const e = row.kapanis_saati.split(':');
                const startMins = parseInt(s[0]) * 60 + parseInt(s[1]);
                const endMins = parseInt(e[0]) * 60 + parseInt(e[1]);
                let diff = endMins - startMins;
                if (diff < 0) diff += 24 * 60; // Cross midnight
                
                totalMinutes += diff;
                if (diff > 60) over60++;
            }
        } catch(e) {}
    });
    
    const avg_duration = durations.length > 0 ? totalMinutes / durations.length : 0;

    // Waiters
    const waitersQuery = `
      SELECT 
          a.garsonno,
          MAX(per.adi) as waiter_name,
          COUNT(DISTINCT a.adsno) as orders,
          COALESCE(SUM(o.otutar), 0) as total
      FROM ads_adisyon a
      LEFT JOIN personel per ON a.garsonno = per.id
      LEFT JOIN ads_odeme o ON a.adsno = o.adsno AND a.adtur = o.adtur AND o.kasa = ANY($1)
      WHERE a.kaptar BETWEEN $2 AND $3 AND a.kasa = ANY($4)
      GROUP BY a.garsonno
      ORDER BY total DESC
      LIMIT 10
    `;
    const waiters = await this.db.executeQuery(pool, waitersQuery, [kasa_nos, dStart, dEnd, kasa_nos]);

    // Products
    const productsQuery = `
      SELECT 
          COALESCE(p.product_name, CAST(a.pluid AS VARCHAR), 'Ürün') as product_name,
          COALESCE(SUM(a.miktar), 0) as quantity,
          COALESCE(SUM(a.tutar), 0) as total
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = ANY($3)
      GROUP BY p.product_name, a.pluid
      ORDER BY total DESC
      LIMIT 10
    `;
    const products = await this.db.executeQuery(pool, productsQuery, [dStart, dEnd, kasa_nos]);

    // Groups
    const groupsQuery = `
      SELECT 
          pg.adi as group_name,
          COALESCE(SUM(a.miktar), 0) as quantity,
          COALESCE(SUM(a.tutar), 0) as total
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      LEFT JOIN product_group pg ON p.tip = pg.id
      WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = ANY($3)
      GROUP BY pg.adi
      ORDER BY total DESC
      LIMIT 10
    `;
    const groups = await this.db.executeQuery(pool, groupsQuery, [dStart, dEnd, kasa_nos]);

    const branchIndex = user.selected_branch || 0;
    const branchName = user.branches[branchIndex]?.name || '';

    return {
        branch: { name: branchName, kasa_no, kasa_nos },
        period: { start: dStart, end: dEnd },
        totals: {
            total_sales: parseFloat(totals.total_sales),
            orders_count: parseInt(totals.orders_count),
            avg_ticket: avg_ticket,
            avg_duration_minutes: avg_duration,
            over60_count: over60,
            total_discount: parseFloat(totals.total_discount)
        },
        waiters,
        products,
        groups
    };
  }

  async getProductSales(user: any, period: string, startDate?: string, endDate?: string, groupId?: number, groupIds?: number[], plu?: number) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    let query = '';
    const params = [];
    const useArray = Array.isArray(groupIds) && groupIds.length > 0;
    const usePlu = typeof plu === 'number' && !isNaN(plu);

    if (period === 'today') {
        // Combine Open and Closed
        query = `
            WITH combined_sales AS (
                SELECT a.pluid, a.miktar, a.tutar
                FROM ads_adisyon a
                WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = ANY($3)
                UNION ALL
                SELECT a.pluid, a.miktar, a.tutar
                FROM ads_acik a
                WHERE a.actar BETWEEN $4 AND $5 AND a.kasa = ANY($6)
            )
            SELECT 
                p.product_name as product_name,
                p.plu as plu,
                p.tip as group_id,
                pg.adi as group_name,
                COALESCE(SUM(cs.miktar), 0) as quantity,
                COALESCE(SUM(cs.tutar), 0) as total
            FROM combined_sales cs
            LEFT JOIN product p ON cs.pluid = p.plu
            LEFT JOIN product_group pg ON p.tip = pg.id
            ${(() => {
              const conds: string[] = [];
              if (useArray) conds.push('p.tip = ANY($7)');
              else if (groupId) conds.push('p.tip = $7');
              const nextIndex = 7 + (useArray || groupId ? 1 : 0);
              if (usePlu) conds.push(`p.plu = $${nextIndex}`);
              return conds.length ? 'WHERE ' + conds.join(' AND ') : '';
            })()}
            GROUP BY p.product_name, p.plu, p.tip, pg.adi
            ORDER BY total DESC
        `;
        params.push(dStart, dEnd, kasa_nos, dStart, dEnd, kasa_nos);
        if (useArray) params.push(groupIds);
        else if (groupId) params.push(groupId);
        if (usePlu) params.push(plu);
    } else {
        // Only Closed
        query = `
            SELECT 
                p.product_name as product_name,
                a.pluid as plu,
                p.tip as group_id,
                pg.adi as group_name,
                COALESCE(SUM(a.miktar), 0) as quantity,
                COALESCE(SUM(a.tutar), 0) as total
            FROM ads_adisyon a
            LEFT JOIN product p ON a.pluid = p.plu
            LEFT JOIN product_group pg ON p.tip = pg.id
            WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = ANY($3)
            ${(() => {
              const conds: string[] = [];
              if (useArray) conds.push('p.tip = ANY($4)');
              else if (groupId) conds.push('p.tip = $4');
              const nextIndex = 4 + (useArray || groupId ? 1 : 0);
              if (usePlu) conds.push(`p.plu = $${nextIndex}`);
              return conds.length ? 'AND ' + conds.join(' AND ') : '';
            })()}
            GROUP BY p.product_name, a.pluid, p.tip, pg.adi
            ORDER BY total DESC
        `;
        params.push(dStart, dEnd, kasa_nos);
        if (useArray) params.push(groupIds);
        else if (groupId) params.push(groupId);
        if (usePlu) params.push(plu);
    }

    const rows = await this.db.executeQuery(pool, query, params);
    return rows;
  }

  async getProductGroups(user: any) {
    const branchIndex = user.selected_branch || 0;
    const branchId = user.branches[branchIndex]?.id;
    const cacheKey = this.cache.generateKey('product_groups', branchId || 'default');
    
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { pool } = await this.getBranchPool(user);
    const q = `
      SELECT id, adi as name
      FROM product_group
      ORDER BY adi ASC
    `;
    const result = await this.db.executeQuery(pool, q, []);
    
    // Cache for 1 hour (product groups rarely change)
    await this.cache.set(cacheKey, result, 3600);
    return result;
  }

  async getPersonnel(user: any) {
    const branchIndex = user.selected_branch || 0;
    const branchId = user.branches[branchIndex]?.id;
    const cacheKey = this.cache.generateKey('personnel', branchId || 'default');
    
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { pool } = await this.getBranchPool(user);
    const q = `
      SELECT id, adi
      FROM personel
      ORDER BY adi ASC
    `;
    const result = await this.db.executeQuery(pool, q, []);
    
    // Cache for 30 minutes (personnel data rarely changes)
    await this.cache.set(cacheKey, result, 1800);
    return result;
  }

  async getUnpayable(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');
    const query = `
      SELECT 
        a.adtur,
        a.adsno,
        a.actar,
        a.acsaat,
        a.kaptar,
        a.masano,
        a.pluid,
        COALESCE(a.miktar, 0) as miktar,
        COALESCE(pf.fiyat, a.bfiyat, 0) as bfiyat,
        COALESCE(a.tutar, 0) as tutar,
        a.ack4,
        a.mustid,
        COALESCE(p.product_name, CAST(a.pluid AS VARCHAR)) as product_name,
        m.adi as musteri_adi,
        m.soyadi as musteri_soyadi
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      LEFT JOIN product_fiyat pf ON pf.plu = a.pluid
      LEFT JOIN ads_musteri m ON a.mustid = m.mustid
      WHERE a.kaptar BETWEEN $1 AND $2
        AND a.kasa = ANY($3)
        AND (
          a.ack4 ILIKE '%ODENMEZ%' OR 
          a.ack4 ILIKE '%ÖDENMEZ%' OR 
          a.ack4 ILIKE '%ODENEMEZ%'
        )
      ORDER BY a.kaptar DESC, a.adsno DESC
    `;
    const rows = await this.db.executeQuery(pool, query, [dStart, dEnd, kasa_nos]);
    return rows.map((r: any) => ({
      adtur: r.adtur,
      adsno: r.adsno,
      tarih: format(r.kaptar || r.actar, 'yyyy-MM-dd'),
      saat: r.acsaat || null,
      kapanis_tarih: r.kaptar ? format(r.kaptar, 'yyyy-MM-dd') : null,
      masano: r.masano,
      pluid: r.pluid,
      product_name: r.product_name,
      miktar: parseFloat(r.miktar),
      bfiyat: parseFloat(r.bfiyat),
      tutar: parseFloat(r.miktar) * parseFloat(r.bfiyat),
      ack4: r.ack4,
      mustid: r.mustid,
      musteri_adi: r.musteri_adi,
      musteri_soyadi: r.musteri_soyadi,
      musteri_fullname: `${r.musteri_adi || ''}${r.musteri_soyadi ? ' ' + r.musteri_soyadi : ''}`.trim(),
    }));
  }

  async getDebts(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');
    const query = `
      WITH agg AS (
        SELECT 
          ads_no,
          MAX(borcu) AS borc,
          MAX(islem_zamani) AS islem_zamani,
          MAX(fisno) AS fisno,
          MAX(pers_id) AS pers_id,
          MAX(musteri) AS musteri
        FROM ads_hareket
        WHERE kasano = ANY($1) AND DATE(islem_zamani) BETWEEN $2 AND $3
        GROUP BY ads_no
      )
      SELECT
        agg.ads_no,
        agg.borc,
        agg.fisno,
        agg.pers_id,
        agg.islem_zamani,
        agg.musteri,
        COALESCE(m.adi, '') as musteri_adi,
        COALESCE(m.soyadi, '') as musteri_soyadi,
        p.adi as personel_adi
      FROM agg
      LEFT JOIN ads_musteri m ON agg.musteri = m.mustid
      LEFT JOIN personel p ON agg.pers_id = p.id
      ORDER BY agg.islem_zamani DESC
    `;
    const rows = await this.db.executeQuery(pool, query, [kasa_nos, dStart, dEnd]);
    return rows.map((r: any) => ({
      adsno: r.ads_no,
      borc: parseFloat(r.borc || 0),
      fisno: r.fisno,
      pers_id: r.pers_id,
      personel_adi: r.personel_adi,
      mustid: r.musteri,
      musteri_fullname: `${r.musteri_adi}${r.musteri_soyadi ? ' ' + r.musteri_soyadi : ''}`.trim(),
      tarih: format(r.islem_zamani, 'yyyy-MM-dd'),
      saat: format(r.islem_zamani, 'HH:mm'),
    }));
  }

  async getDiscountOrders(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    const query = `
      SELECT 
        o.adsno,
        o.raptar as tarih,
        MAX(a.kapsaat) as kapanis_saati,
        MAX(a.acsaat) as acilis_saati,
        MAX(COALESCE(a.masano, 0)) as masano,
        MAX(COALESCE(a.masano, 0)) as masa_no,
        SUM(o.otutar) as tutar,
        SUM(o.iskonto) as iskonto,
        MAX(CONCAT(COALESCE(m.adi, ''), ' ', COALESCE(m.soyadi, ''))) as customer_name,
        MAX(o.mustid) as mustid,
        MAX(p.adi) as garson_adi,
        MAX(od.odmname) as payment_name
      FROM ads_odeme o
      LEFT JOIN ads_adisyon a ON o.adsno = a.adsno AND o.kasa = a.kasa
      LEFT JOIN ads_musteri m ON o.mustid = m.mustid
      LEFT JOIN personel p ON a.garsonno = p.id
      LEFT JOIN ads_odmsekli od ON o.otip = od.odmno
      WHERE o.kasa = ANY($1)
        AND o.raptar BETWEEN $2 AND $3
        AND o.iskonto > 0
      GROUP BY o.adsno, o.raptar
      ORDER BY o.raptar DESC, o.adsno DESC
    `;

    const rows = await this.db.executeQuery(pool, query, [kasa_nos, dStart, dEnd]);
    return rows;
  }
}
