import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';
import { format } from 'date-fns';

@Injectable()
export class ReportsService {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
  ) {}

  private getTurkeyTime() {
    const now = new Date();
    const turkeyOffset = 3 * 60;
    const utcOffset = now.getTimezoneOffset();
    return new Date(now.getTime() + (utcOffset + turkeyOffset) * 60000);
  }

  private getTurkeyTimeComponents() {
    const now = new Date();
    const turkeyOffset = 3 * 60;
    const utcOffset = now.getTimezoneOffset();
    const turkeyTime = new Date(
      now.getTime() + (utcOffset + turkeyOffset) * 60000,
    );

    return {
      year: turkeyTime.getUTCFullYear(),
      month: turkeyTime.getUTCMonth(),
      day: turkeyTime.getUTCDate(),
      hour: turkeyTime.getUTCHours(),
      minute: turkeyTime.getUTCMinutes(),
      turkeyTime,
    };
  }

  private getDateRange(
    period: string,
    closingHour: number,
    startDate?: string,
    endDate?: string,
  ) {
    const { year, month, day, hour, minute, turkeyTime } =
      this.getTurkeyTimeComponents();
    const safeClosing = Number.isFinite(closingHour)
      ? Math.min(23, Math.max(0, Math.floor(closingHour)))
      : 6;

    let start: Date;
    let end: Date;

    // Şu anki Türkiye saatini dakika cinsinden hesapla
    const currentTurkeyHourMinutes = hour * 60 + minute;
    const closingHourMinutes = safeClosing * 60;

    // Bugünkü kapanış saatini UTC olarak hesapla (Türkiye = UTC+3)
    const todayClosingUTC = Date.UTC(
      year,
      month,
      day,
      safeClosing - 3,
      0,
      0,
      0,
    );
    const todayClosing = new Date(todayClosingUTC);

    console.log(`[getDateRange] period=${period}, closingHour=${safeClosing}`);
    console.log(
      `[getDateRange] Turkey time: ${year}-${month + 1}-${day} ${hour}:${minute}`,
    );
    console.log(
      `[getDateRange] currentTurkeyHourMinutes=${currentTurkeyHourMinutes}, closingHourMinutes=${closingHourMinutes}`,
    );

    if (period === 'today') {
      if (currentTurkeyHourMinutes < closingHourMinutes) {
        // Kapanış saatinden önce: devam eden iş günü dündür
        end = todayClosing;
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        console.log(
          `[getDateRange] Before closing hour - using yesterday's business day`,
        );
      } else {
        // Kapanıştan sonra: yeni iş günü bugün kapanışta başladı
        start = todayClosing;
        end = new Date(todayClosing.getTime() + 24 * 60 * 60 * 1000);
        console.log(
          `[getDateRange] After closing hour - using today's business day`,
        );
      }
    } else if (period === 'yesterday') {
      let todayStart: Date;
      let todayEnd: Date;

      if (currentTurkeyHourMinutes < closingHourMinutes) {
        todayEnd = todayClosing;
        todayStart = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);
      } else {
        todayStart = todayClosing;
        todayEnd = new Date(todayClosing.getTime() + 24 * 60 * 60 * 1000);
      }

      start = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      end = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === 'week') {
      // Türkiye saatinde haftanın başını bul (Pazartesi)
      const dayOfWeek = turkeyTime.getUTCDay(); // 0 = Pazar
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStartUTC = Date.UTC(
        year,
        month,
        day - daysToMonday,
        0 - 3,
        0,
        0,
        0,
      );
      start = new Date(weekStartUTC);
      // Bugünün sonuna kadar
      const todayEndUTC = Date.UTC(year, month, day, 23 - 3, 59, 59, 999);
      end = new Date(todayEndUTC);
    } else if (period === 'last7days') {
      const startDayUTC = Date.UTC(year, month, day - 6, 0 - 3, 0, 0, 0);
      start = new Date(startDayUTC);
      const todayEndUTC = Date.UTC(year, month, day, 23 - 3, 59, 59, 999);
      end = new Date(todayEndUTC);
    } else if (period === 'month') {
      const monthStartUTC = Date.UTC(year, month, 1, 0 - 3, 0, 0, 0);
      start = new Date(monthStartUTC);
      const todayEndUTC = Date.UTC(year, month, day, 23 - 3, 59, 59, 999);
      end = new Date(todayEndUTC);
    } else if (period === 'lastmonth') {
      const lastMonthYear = month === 0 ? year - 1 : year;
      const lastMonth = month === 0 ? 11 : month - 1;
      const lastDayOfLastMonth = new Date(
        Date.UTC(year, month, 0),
      ).getUTCDate();
      const lastMonthStartUTC = Date.UTC(
        lastMonthYear,
        lastMonth,
        1,
        0 - 3,
        0,
        0,
        0,
      );
      start = new Date(lastMonthStartUTC);
      const lastMonthEndUTC = Date.UTC(
        lastMonthYear,
        lastMonth,
        lastDayOfLastMonth,
        23 - 3,
        59,
        59,
        999,
      );
      end = new Date(lastMonthEndUTC);
    } else if (period === 'custom' && startDate && endDate) {
      const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
      const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
      start = new Date(Date.UTC(sYear, sMonth - 1, sDay, 0 - 3, 0, 0, 0));
      end = new Date(Date.UTC(eYear, eMonth - 1, eDay, 23 - 3, 59, 59, 999));
    } else {
      // Default: bugün
      const todayStartUTC = Date.UTC(year, month, day, 0 - 3, 0, 0, 0);
      start = new Date(todayStartUTC);
      const todayEndUTC = Date.UTC(year, month, day, 23 - 3, 59, 59, 999);
      end = new Date(todayEndUTC);
    }

    console.log(
      `[getDateRange] Result: start=${start.toISOString()}, end=${end.toISOString()}`,
    );

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
      kasa_nos = Array.from(
        new Set([
          primary,
          ...branch.kasalar.filter((k: any) => typeof k === 'number'),
        ]),
      );
    } else if (branch.id) {
      try {
        const mainPool = this.db.getMainPool();
        const rows = await this.db.executeQuery(
          mainPool,
          'SELECT kasa_no FROM branch_kasas WHERE branch_id = $1',
          [branch.id],
        );
        const extras = rows
          .map((r: any) => parseInt(r.kasa_no))
          .filter((n: any) => !isNaN(n));
        kasa_nos = Array.from(new Set([primary, ...extras]));
      } catch {}
    }

    let closingHour = 6;
    const rawClosing = (branch as any).closing_hour;
    if (typeof rawClosing === 'number' && Number.isFinite(rawClosing)) {
      closingHour = rawClosing;
    } else if (typeof rawClosing === 'string') {
      const parsed = parseInt(rawClosing, 10);
      if (Number.isFinite(parsed)) {
        closingHour = parsed;
      }
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
      kasa_nos,
      closingHour,
    };
  }

  async getOrders(
    user: any,
    period: string,
    status: 'open' | 'closed',
    startDate?: string,
    endDate?: string,
    type?: 'adisyon' | 'paket',
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );
    const dStart = format(start, 'yyyy-MM-dd');
    let dEnd = format(end, 'yyyy-MM-dd');

    // Tek iş günü bazlı raporlar için (Bugün / Dün) raptar ve actar tarih
    // aralıklarını tek güne sabitle
    if (period === 'today' || period === 'yesterday') {
      dEnd = dStart;
    }

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
                    WHERE a.kasa = ANY($1)
                    GROUP BY a.adsno
                    ORDER BY a.adsno DESC
                    LIMIT 200
                `;
          rows = await this.db.executeQuery(pool, fbSingleQuery, [kasa_nos]);
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

  async getOrderDetails(
    user: any,
    adsno: string,
    status: 'open' | 'closed',
    date?: string,
    adtur?: number,
  ) {
    const { pool, kasa_nos } = await this.getBranchPool(user);
    let resolvedAdtur = typeof adtur !== 'undefined' ? adtur : undefined;
    if (typeof resolvedAdtur === 'undefined') {
      try {
        if (status === 'closed') {
          const r = await this.db.executeQuery(
            pool,
            `
            SELECT COALESCE(adtur, CASE WHEN masano = 99999 THEN 1 ELSE 0 END) AS adtur
            FROM ads_adisyon
            WHERE kasa = ANY($1) AND adsno = $2
            ORDER BY kaptar DESC, kapsaat DESC
            LIMIT 1
          `,
            [kasa_nos, adsno],
          );
          if (r && r[0] && typeof r[0].adtur !== 'undefined')
            resolvedAdtur = parseInt(r[0].adtur);
        } else {
          const r = await this.db.executeQuery(
            pool,
            `
            SELECT COALESCE(adtur, CASE WHEN sipyer = 2 OR masano = 99999 THEN 1 ELSE 0 END) AS adtur
            FROM ads_acik
            WHERE kasa = ANY($1) AND adsno = $2
            ORDER BY actar DESC, acsaat DESC
            LIMIT 1
          `,
            [kasa_nos, adsno],
          );
          if (r && r[0] && typeof r[0].adtur !== 'undefined')
            resolvedAdtur = parseInt(r[0].adtur);
        }
      } catch {}
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
      const params =
        typeof resolvedAdtur !== 'undefined'
          ? [kasa_nos, adsno, resolvedAdtur]
          : [kasa_nos, adsno];
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
      const rows = await this.db.executeQuery(
        pool,
        query,
        typeof resolvedAdtur !== 'undefined'
          ? [kasa_nos, adsno, resolvedAdtur]
          : [kasa_nos, adsno],
      );
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
    const openCount = await this.db.executeQuery(pool, openCountQuery, [
      kasa_nos,
      adsno,
    ]);
    const closedCount = await this.db.executeQuery(pool, closedCountQuery, [
      kasa_nos,
      adsno,
    ]);
    const openItems = await this.db.executeQuery(pool, openItemsQuery, [
      kasa_nos,
      adsno,
    ]);
    const closedItems = await this.db.executeQuery(pool, closedItemsQuery, [
      kasa_nos,
      adsno,
    ]);
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

  private async hasColumn(
    pool: any,
    table: string,
    column: string,
  ): Promise<boolean> {
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

  async getDashboard(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const cacheKey = this.cache.generateKey(
      'dashboard_v2',
      user.id,
      period,
      startDate || 'none',
      endDate || 'none',
      user.selected_branch || 0,
    );
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
      kasa_raporu: {
        nakit: 0,
        kredi_karti: 0,
        yemek_karti: 0,
        diger: 0,
        toplam: 0,
      },
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
      const [openOrders, closedOrders, performance, debts, cancelledItems, cashReport] =
        await Promise.all([
          this.getOrders(user, period, 'open', startDate, endDate).catch(
            () => [],
          ),
          this.getOrders(user, period, 'closed', startDate, endDate).catch(
            () => [],
          ),
          this.getPerformance(user, period, startDate, endDate).catch(
            () => null,
          ),
          this.getDebts(user, period, startDate, endDate).catch(() => []),
          this.getCancelledItems(user, period, startDate, endDate).catch(
            () => [],
          ),
          this.getCashReport(user, period, startDate, endDate).catch(
            () => ({ totals: { nakit: 0, kredi_karti: 0, yemek_karti: 0, diger: 0, toplam: 0 }, rows: [] }),
          ),
        ]);

      const mapOrderType = (row: any) => {
        const adturNum =
          typeof row.adtur === 'number'
            ? row.adtur
            : parseInt(row.adtur ?? '0', 10) || 0;
        if (adturNum === 1) return 'paket';
        if (adturNum === 3) return 'hizli';
        return 'adisyon';
      };

      let totalOpenAmount = 0;
      let totalClosedAmount = 0;

      (openOrders as any[]).forEach((o) => {
        const key = mapOrderType(o);
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
        const key = mapOrderType(o);
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
        if (
          totalSales > 0 &&
          result.kapali_iskonto_toplam > 0 &&
          g.kapali_toplam > 0
        ) {
          const share = g.kapali_toplam / totalSales;
          g.kapali_iskonto = Number(
            (result.kapali_iskonto_toplam * share).toFixed(2),
          );
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

      // Kasa Raporu verilerini ekle
      if (cashReport && cashReport.totals) {
        result.kasa_raporu = {
          nakit: cashReport.totals.nakit || 0,
          kredi_karti: cashReport.totals.kredi_karti || 0,
          yemek_karti: cashReport.totals.yemek_karti || 0,
          diger: cashReport.totals.diger || 0,
          toplam: cashReport.totals.toplam || 0,
        };
      }
    } catch {}

    await this.cache.set(cacheKey, result, cacheTTL);
    return result;
  }

  async getSalesChart(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );

    // raptar (rapor tarihi) kullanarak sorgula - gün dönüm saatine göre doğru filtreleme
    const startDateOnly = format(start, 'yyyy-MM-dd');
    const endDateOnly = format(end, 'yyyy-MM-dd');

    const baseQuery = `
      SELECT 
          raptar as tarih,
          SUM(COALESCE(tutar, 0)) as toplam
      FROM ads_adisyon
      WHERE raptar >= $1::date AND raptar <= $2::date
    `;

    const primaryQuery = `
      ${baseQuery} AND kasa = ANY($3)
      GROUP BY raptar
      ORDER BY raptar
    `;

    let rows = await this.db.executeQuery(pool, primaryQuery, [
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);

    if (!rows || rows.length === 0) {
      const fallbackQuery = `
        ${baseQuery}
        GROUP BY raptar
        ORDER BY raptar
      `;
      rows = await this.db.executeQuery(pool, fallbackQuery, [
        startDateOnly,
        endDateOnly,
      ]);
    }

    return rows.map((row) => ({
      tarih: format(row.tarih, 'yyyy-MM-dd'),
      toplam: parseFloat(row.toplam),
    }));
  }

  async getPaymentTypes(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );
    const dStart = format(start, 'yyyy-MM-dd HH:mm:ss');
    const dEnd = format(end, 'yyyy-MM-dd HH:mm:ss');

    const query = `
      SELECT 
          COALESCE(od.odmname, 'Tanımsız') as payment_name,
          COALESCE(SUM(o.otutar), 0) as total,
          COUNT(DISTINCT o.adsno) as count,
          COALESCE(od.odmno, NULL) as otip
      FROM ads_odeme o
      LEFT JOIN ads_odmsekli od ON o.otip = od.odmno
      WHERE o.raptar >= $1 AND o.raptar < $2 AND o.kasa = ANY($3)
      GROUP BY od.odmno, od.odmname
      ORDER BY total DESC
    `;

    const rows = await this.db.executeQuery(pool, query, [
      dStart,
      dEnd,
      kasa_nos,
    ]);
    return rows.map((row) => ({
      payment_name: row.payment_name,
      total: parseFloat(row.total),
      count: parseInt(row.count),
      otip: row.otip,
    }));
  }

  async getCourierTracking(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );

    // raptar ve actar için sadece tarih formatı kullan
    const startDateOnly = format(start, 'yyyy-MM-dd');
    const endDateOnly = format(end, 'yyyy-MM-dd');

    // Açık siparişler - actar kullan
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
        AND a.actar >= $2::date AND a.actar <= $3::date
    `;
    const openRows = await this.db.executeQuery(pool, openQuery, [
      kasa_nos,
      startDateOnly,
      endDateOnly,
    ]);

    // Kapalı siparişler - raptar kullan
    const closedQuery = `
      SELECT DISTINCT
          a.adsno,
          per.adi as kurye,
          a.motcikis as cikis,
          a.stopsaat as donus,
          a.raptar as tarih,
          a.sipsaat as sipsaat,
          a.stoptar as stoptar,
          'closed' as status
      FROM ads_adisyon a
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.kasa = ANY($1::int[])
        AND (COALESCE(a.adtur, 0) = 1 OR a.masano = 99999)
        AND a.raptar >= $2::date AND a.raptar <= $3::date
    `;
    const closedRows = await this.db.executeQuery(pool, closedQuery, [
      kasa_nos,
      startDateOnly,
      endDateOnly,
    ]);

    const results = [...openRows, ...closedRows];
    results.sort((a, b) => {
      const da = new Date(a.tarih);
      const db = new Date(b.tarih);
      return db.getTime() - da.getTime();
    });
    if (results.length > 0) return results;

    // Fallback sorgular
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
          a.raptar as tarih,
          a.sipsaat as sipsaat,
          a.stoptar as stoptar,
          'closed' as status
      FROM ads_adisyon a
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.kasa = ANY($1::int[])
        AND (COALESCE(a.adtur, 0) = 1 OR a.masano = 99999)
      ORDER BY a.raptar DESC
      LIMIT 100
    `;
    const fbOpen = await this.db.executeQuery(pool, fbOpenQuery, [kasa_nos]);
    const fbClosed = await this.db.executeQuery(pool, fbClosedQuery, [
      kasa_nos,
    ]);
    const fbRes = [...fbOpen, ...fbClosed];
    fbRes.sort(
      (a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime(),
    );
    return fbRes;
  }

  async getCancelledItems(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );

    // raptar ve actar için sadece tarih formatı kullan
    const startDateOnly = format(start, 'yyyy-MM-dd');
    const endDateOnly = format(end, 'yyyy-MM-dd');

    // Open - actar kullan
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
      WHERE a.actar >= $1::date AND a.actar <= $2::date AND a.kasa = ANY($3) AND a.sturu IN (1,2,4)
    `;
    const openRows = await this.db.executeQuery(pool, openQuery, [
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);

    // Closed - raptar kullan
    const closedQuery = `
      SELECT 
          COALESCE(p.product_name, CAST(a.pluid AS VARCHAR), 'Ürün') as product_name,
          COALESCE(a.miktar, 0) as quantity,
          a.ack1 as reason,
          a.raptar as date,
          a.adsno as order_id,
          a.adtur as adtur,
          per.adi as waiter_name,
          CASE a.sturu WHEN 1 THEN 'ikram' WHEN 2 THEN 'iade' WHEN 4 THEN 'iptal' ELSE 'diğer' END as type,
          'closed' as status
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.raptar >= $1::date AND a.raptar <= $2::date AND a.kasa = ANY($3) AND a.sturu IN (1,2,4)
    `;
    const closedRows = await this.db.executeQuery(pool, closedQuery, [
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);

    const results = [...openRows, ...closedRows];
    results.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return results.slice(0, 200);
  }

  async getUnsoldCancels(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );
    const dStart = format(start, 'yyyy-MM-dd HH:mm:ss');
    const dEnd = format(end, 'yyyy-MM-dd HH:mm:ss');
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
      WHERE a.tarih_saat >= $1 AND a.tarih_saat < $2
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
      tutar: parseFloat(r.tutar),
    }));
  }

  async getPerformance(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_no, kasa_nos, closingHour } =
      await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );

    // raptar için sadece tarih formatı kullan
    const startDateOnly = format(start, 'yyyy-MM-dd');
    let endDateOnly = format(end, 'yyyy-MM-dd');

    // Bugün döneminde, raptar bazlı sorgularda iki farklı tarihi kapsayıp
    // dünkü ve bugünkü satışları birlikte toplamamak için tek iş günü tarihi kullan
    if (period === 'today') {
      endDateOnly = startDateOnly;
    }

    console.log(
      `[getPerformance] period=${period}, startDateOnly=${startDateOnly}, endDateOnly=${endDateOnly}`,
    );

    // Totals - raptar kullan
    const totalsQuery = `
      SELECT 
          COALESCE(SUM(o.otutar), 0) as total_sales,
          COUNT(DISTINCT o.adsno) as orders_count,
          COALESCE(SUM(o.iskonto), 0) as total_discount
      FROM ads_odeme o
      WHERE o.raptar >= $1::date AND o.raptar <= $2::date AND o.kasa = ANY($3)
    `;
    const totalsRows = await this.db.executeQuery(pool, totalsQuery, [
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);
    const totals = totalsRows[0] || {
      total_sales: 0,
      orders_count: 0,
      total_discount: 0,
    };
    const avg_ticket =
      parseFloat(totals.total_sales) /
      Math.max(1, parseInt(totals.orders_count));

    // Duration - raptar kullan
    const durationQuery = `
      SELECT 
          a.adsno,
          MAX(a.acsaat) as acilis_saati,
          MAX(a.kapsaat) as kapanis_saati,
          MAX(a.raptar) as tarih
      FROM ads_adisyon a
      WHERE a.raptar >= $1::date AND a.raptar <= $2::date AND a.kasa = ANY($3)
      GROUP BY a.adsno
    `;
    const durations = await this.db.executeQuery(pool, durationQuery, [
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);

    let totalMinutes = 0;
    let over60 = 0;

    durations.forEach((row) => {
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
      } catch {}
    });

    const avg_duration =
      durations.length > 0 ? totalMinutes / durations.length : 0;

    // Waiters - raptar kullan
    const waitersQuery = `
      SELECT 
          a.garsonno,
          MAX(per.adi) as waiter_name,
          COUNT(DISTINCT a.adsno) as orders,
          COALESCE(SUM(o.otutar), 0) as total
      FROM ads_adisyon a
      LEFT JOIN personel per ON a.garsonno = per.id
      LEFT JOIN ads_odeme o ON a.adsno = o.adsno AND a.adtur = o.adtur AND o.kasa = ANY($1)
      WHERE a.raptar >= $2::date AND a.raptar <= $3::date AND a.kasa = ANY($4)
      GROUP BY a.garsonno
      ORDER BY total DESC
      LIMIT 10
    `;
    const waiters = await this.db.executeQuery(pool, waitersQuery, [
      kasa_nos,
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);

    // Products - raptar kullan
    const productsQuery = `
      SELECT 
          COALESCE(p.product_name, CAST(a.pluid AS VARCHAR), 'Ürün') as product_name,
          COALESCE(SUM(a.miktar), 0) as quantity,
          COALESCE(SUM(a.tutar), 0) as total
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      WHERE a.raptar >= $1::date AND a.raptar <= $2::date AND a.kasa = ANY($3)
      GROUP BY p.product_name, a.pluid
      ORDER BY total DESC
      LIMIT 10
    `;
    const products = await this.db.executeQuery(pool, productsQuery, [
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);

    // Groups - raptar kullan
    const groupsQuery = `
      SELECT 
          pg.adi as group_name,
          COALESCE(SUM(a.miktar), 0) as quantity,
          COALESCE(SUM(a.tutar), 0) as total
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      LEFT JOIN product_group pg ON p.tip = pg.id
      WHERE a.raptar >= $1::date AND a.raptar <= $2::date AND a.kasa = ANY($3)
      GROUP BY pg.adi
      ORDER BY total DESC
      LIMIT 10
    `;
    const groups = await this.db.executeQuery(pool, groupsQuery, [
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);

    const branchIndex = user.selected_branch || 0;
    const branchName = user.branches[branchIndex]?.name || '';

    return {
      branch: { name: branchName, kasa_no, kasa_nos },
      period: { start: startDateOnly, end: endDateOnly },
      totals: {
        total_sales: parseFloat(totals.total_sales),
        orders_count: parseInt(totals.orders_count),
        avg_ticket: avg_ticket,
        avg_duration_minutes: avg_duration,
        over60_count: over60,
        total_discount: parseFloat(totals.total_discount),
      },
      waiters,
      products,
      groups,
    };
  }

  async getProductSales(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
    groupId?: number,
    groupIds?: number[],
    plu?: number,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );

    // raptar ve actar için sadece tarih formatı kullan
    const startDateOnly = format(start, 'yyyy-MM-dd');
    const endDateOnly = format(end, 'yyyy-MM-dd');

    let query = '';
    const params = [];
    const useArray = Array.isArray(groupIds) && groupIds.length > 0;
    const usePlu = typeof plu === 'number' && !isNaN(plu);

    if (period === 'today') {
      // Combine Open and Closed - raptar ve actar kullan
      query = `
            WITH combined_sales AS (
                SELECT a.pluid, a.miktar, a.tutar
                FROM ads_adisyon a
                WHERE a.raptar = $1::date AND a.kasa = ANY($2)
                UNION ALL
                SELECT a.pluid, a.miktar, a.tutar
                FROM ads_acik a
                WHERE a.actar = $3::date AND a.kasa = ANY($4)
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
              if (useArray) conds.push('p.tip = ANY($5)');
              else if (groupId) conds.push('p.tip = $5');
              const nextIndex = 5 + (useArray || groupId ? 1 : 0);
              if (usePlu) conds.push(`p.plu = $${nextIndex}`);
              return conds.length ? 'WHERE ' + conds.join(' AND ') : '';
            })()}
            GROUP BY p.product_name, p.plu, p.tip, pg.adi
            ORDER BY total DESC
        `;
      params.push(startDateOnly, kasa_nos, startDateOnly, kasa_nos);
      if (useArray) params.push(groupIds);
      else if (groupId) params.push(groupId);
      if (usePlu) params.push(plu);
    } else {
      // Only Closed - raptar kullan
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
            WHERE a.raptar >= $1::date AND a.raptar <= $2::date AND a.kasa = ANY($3)
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
      params.push(startDateOnly, endDateOnly, kasa_nos);
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
    const cacheKey = this.cache.generateKey(
      'product_groups',
      branchId || 'default',
    );

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

  async getUnpayable(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );
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
    const rows = await this.db.executeQuery(pool, query, [
      dStart,
      dEnd,
      kasa_nos,
    ]);
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
      musteri_fullname:
        `${r.musteri_adi || ''}${r.musteri_soyadi ? ' ' + r.musteri_soyadi : ''}`.trim(),
    }));
  }

  async getDebts(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );
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
    const rows = await this.db.executeQuery(pool, query, [
      kasa_nos,
      dStart,
      dEnd,
    ]);
    return rows.map((r: any) => ({
      adsno: r.ads_no,
      borc: parseFloat(r.borc || 0),
      fisno: r.fisno,
      pers_id: r.pers_id,
      personel_adi: r.personel_adi,
      mustid: r.musteri,
      musteri_fullname:
        `${r.musteri_adi}${r.musteri_soyadi ? ' ' + r.musteri_soyadi : ''}`.trim(),
      tarih: format(r.islem_zamani, 'yyyy-MM-dd'),
      saat: format(r.islem_zamani, 'HH:mm'),
    }));
  }

  async getDiscountOrders(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    const query = `
      WITH payments AS (
        SELECT 
          o.adsno,
          DATE(o.raptar) as raptar,
          COALESCE(SUM(o.otutar), 0) as net_tutar,
          COALESCE(SUM(o.iskonto), 0) as iskonto,
          COALESCE(SUM(o.otutar + o.iskonto), 0) as tutar,
          MAX(o.mustid) as mustid
        FROM ads_odeme o
        WHERE o.kasa = ANY($1)
          AND DATE(o.raptar) BETWEEN $2 AND $3
          AND o.iskonto > 0
        GROUP BY o.adsno, DATE(o.raptar)
      ),
      adisyon_agg AS (
        SELECT
          a.adsno,
          MAX(a.kapsaat) as kapanis_saati,
          MAX(a.acsaat) as acilis_saati,
          MAX(COALESCE(a.masano, 0)) as masa_no,
          MAX(a.garsonno) as garsonno
        FROM ads_adisyon a
        WHERE a.kasa = ANY($1)
        GROUP BY a.adsno
      )
      SELECT
        p.adsno,
        p.raptar as tarih,
        a.kapanis_saati,
        a.acilis_saati,
        a.masa_no,
        p.net_tutar,
        p.iskonto,
        p.tutar,
        COALESCE(CONCAT(COALESCE(m.adi, ''), ' ', COALESCE(m.soyadi, '')), '') as customer_name,
        p.mustid,
        per.adi as garson_adi
      FROM payments p
      LEFT JOIN adisyon_agg a ON a.adsno = p.adsno
      LEFT JOIN ads_musteri m ON p.mustid = m.mustid
      LEFT JOIN personel per ON a.garsonno = per.id
      ORDER BY p.raptar DESC, p.adsno DESC
    `;

    const rows = await this.db.executeQuery(pool, query, [
      kasa_nos,
      dStart,
      dEnd,
    ]);
    return rows;
  }

  // Yeni Personel Raporu - Detaylı
  async getPersonnelReport(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );

    // raptar için sadece tarih formatı kullan
    const startDateOnly = format(start, 'yyyy-MM-dd');
    const endDateOnly = format(end, 'yyyy-MM-dd');

    console.log(
      `[getPersonnelReport] period=${period}, startDateOnly=${startDateOnly}, endDateOnly=${endDateOnly}`,
    );

    // Personel bazlı satış ve sipariş özeti - raptar kullan
    const personnelQuery = `
      SELECT 
          a.garsonno as personnel_id,
          per.adi as personnel_name,
          COUNT(DISTINCT a.adsno) as order_count,
          COALESCE(SUM(a.tutar), 0) as total_sales,
          COALESCE(SUM(CASE WHEN a.sturu = 1 THEN a.tutar ELSE 0 END), 0) as ikram_total,
          COALESCE(SUM(CASE WHEN a.sturu = 2 THEN a.tutar ELSE 0 END), 0) as iade_total,
          COALESCE(SUM(CASE WHEN a.sturu = 4 THEN a.tutar ELSE 0 END), 0) as iptal_total,
          COUNT(CASE WHEN a.sturu = 1 THEN 1 END) as ikram_count,
          COUNT(CASE WHEN a.sturu = 2 THEN 1 END) as iade_count,
          COUNT(CASE WHEN a.sturu = 4 THEN 1 END) as iptal_count
      FROM ads_adisyon a
      LEFT JOIN personel per ON a.garsonno = per.id
      WHERE a.raptar >= $1::date AND a.raptar <= $2::date 
        AND a.kasa = ANY($3)
      GROUP BY a.garsonno, per.adi
      ORDER BY total_sales DESC
    `;

    const personnelRows = await this.db.executeQuery(pool, personnelQuery, [
      startDateOnly,
      endDateOnly,
      kasa_nos,
    ]);

    // Açık siparişleri de dahil et (bugün için) - actar kullan
    const openOrdersMap = new Map();
    if (period === 'today') {
      const openQuery = `
        SELECT 
            a.garsonno as personnel_id,
            COUNT(DISTINCT a.adsno) as open_order_count,
            COALESCE(SUM(a.tutar), 0) as open_total
        FROM ads_acik a
        WHERE a.actar >= $1::date AND a.actar <= $2::date 
          AND a.kasa = ANY($3)
        GROUP BY a.garsonno
      `;
      const openRows = await this.db.executeQuery(pool, openQuery, [
        startDateOnly,
        endDateOnly,
        kasa_nos,
      ]);
      openRows.forEach((row: any) => {
        openOrdersMap.set(row.personnel_id, {
          open_order_count: parseInt(row.open_order_count) || 0,
          open_total: parseFloat(row.open_total) || 0,
        });
      });
    }

    // Toplam hesapla
    let grandTotal = 0;
    let grandOrderCount = 0;

    const personnel = personnelRows.map((row: any) => {
      const openData = openOrdersMap.get(row.personnel_id) || {
        open_order_count: 0,
        open_total: 0,
      };
      const closedTotal = parseFloat(row.total_sales) || 0;
      const total = closedTotal + openData.open_total;
      const orderCount =
        (parseInt(row.order_count) || 0) + openData.open_order_count;

      grandTotal += total;
      grandOrderCount += orderCount;

      return {
        id: row.personnel_id,
        name: row.personnel_name || 'Bilinmiyor',
        order_count: orderCount,
        closed_order_count: parseInt(row.order_count) || 0,
        open_order_count: openData.open_order_count,
        total_sales: total,
        closed_sales: closedTotal,
        open_sales: openData.open_total,
        avg_ticket: orderCount > 0 ? total / orderCount : 0,
        ikram_total: parseFloat(row.ikram_total) || 0,
        iade_total: parseFloat(row.iade_total) || 0,
        iptal_total: parseFloat(row.iptal_total) || 0,
        ikram_count: parseInt(row.ikram_count) || 0,
        iade_count: parseInt(row.iade_count) || 0,
        iptal_count: parseInt(row.iptal_count) || 0,
      };
    });

    return {
      period: { start: startDateOnly, end: endDateOnly },
      summary: {
        total_sales: grandTotal,
        total_orders: grandOrderCount,
        personnel_count: personnel.length,
        avg_per_personnel:
          personnel.length > 0 ? grandTotal / personnel.length : 0,
      },
      personnel,
    };
  }

  async getCashReport(
    user: any,
    period: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { pool, kasa_nos, closingHour } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(
      period,
      closingHour,
      startDate,
      endDate,
    );
    const startDateOnly = format(start, 'yyyy-MM-dd');
    let endDateOnly = format(end, 'yyyy-MM-dd');
    
    // Özel tarih aralığı varsa kullan, yoksa period'a göre ayarla
    if (startDate && endDate) {
      // Kullanıcı özel tarih seçtiyse tam aralığı kullan
      endDateOnly = format(end, 'yyyy-MM-dd');
    } else if (period === 'today' || period === 'yesterday') {
      // Bugün/dün gibi tek günlük periodlarda başlangıç ve bitiş aynı gün
      endDateOnly = startDateOnly;
    }

    let hasRaptar = false;
    let hasKasa = false;
    let hasAciklama = false;
    let hasTutar = false;
    
    try {
      hasRaptar = await this.hasColumn(pool, 'kasa_raporu', 'raptar');
      hasKasa = await this.hasColumn(pool, 'kasa_raporu', 'kasa');
      hasAciklama = await this.hasColumn(pool, 'kasa_raporu', 'aciklama');
      hasTutar = await this.hasColumn(pool, 'kasa_raporu', 'tutar');
    } catch {}

    let query = '';
    let params: any[] = [];

    if (hasRaptar && hasKasa) {
      query = `
        SELECT 
          *,
          raptar as tarih,
          ${hasAciklama ? 'aciklama' : "'İşlem'"} as aciklama,
          ${hasTutar ? 'tutar' : '0.00'} as tutar
        FROM kasa_raporu
        WHERE raptar >= $1::date AND raptar <= $2::date
          AND kasa = ANY($3)
        ORDER BY raptar DESC, kasa ASC
      `;
      params = [startDateOnly, endDateOnly, kasa_nos];
    } else if (hasRaptar) {
      query = `
        SELECT 
          *,
          raptar as tarih,
          ${hasAciklama ? 'aciklama' : "'İşlem'"} as aciklama,
          ${hasTutar ? 'tutar' : '0.00'} as tutar
        FROM kasa_raporu
        WHERE raptar >= $1::date AND raptar <= $2::date
        ORDER BY raptar DESC
      `;
      params = [startDateOnly, endDateOnly];
    } else {
      query = `
        SELECT 
          *,
          'Tarih Yok' as tarih,
          'İşlem' as aciklama,
          '0.00' as tutar
        FROM kasa_raporu
        ORDER BY 1 DESC
        LIMIT 500
      `;
    }

    const rows = await this.db.executeQuery(pool, query, params);
    
    // Toplam tutarları hesapla
    const totals = rows.reduce((acc, row) => {
      const tutar = parseFloat(row.tutar || row.toplam || 0);
      const aciklama = (row.aciklama || row.tur || 'İşlem').toLowerCase();
      
      if (aciklama.includes('nakit')) {
        acc.nakit += tutar;
      } else if (aciklama.includes('kredi') || aciklama.includes('kart')) {
        acc.kredi_karti += tutar;
      } else if (aciklama.includes('yemek') || aciklama.includes('ticket')) {
        acc.yemek_karti += tutar;
      } else {
        acc.diger += tutar;
      }
      
      acc.toplam += tutar;
      return acc;
    }, { nakit: 0, kredi_karti: 0, yemek_karti: 0, diger: 0, toplam: 0 });

    return {
      period: { start: startDateOnly, end: endDateOnly },
      count: rows.length || 0,
      totals,
      rows: rows.map(row => ({
        ...row,
        tarih: row.raptar || row.tarih || startDateOnly,
        tutar: parseFloat(row.tutar || row.toplam || 0).toFixed(2),
      })),
    };
  }
}
