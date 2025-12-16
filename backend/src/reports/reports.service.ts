import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, endOfMonth, parseISO, format } from 'date-fns';

@Injectable()
export class ReportsService {
  constructor(private db: DatabaseService) {}

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
        const query = `
            SELECT 
                a.adsno,
                CAST(a.sipyer AS INTEGER) as sipyer,
                MAX(COALESCE(a.masano, 0)) as masano,
                MAX(COALESCE(a.masano, 0)) as masa_no,
                MAX(COALESCE(a.adtur, 0)) as adtur,
                CASE 
                  WHEN CAST(a.sipyer AS INTEGER) = 2 THEN 'Paket'
                  ELSE 'Adisyon'
                END as type_label,
                SUM(COALESCE(a.tutar, 0)) as tutar,
                MAX(p.adi) as garson,
                MAX(m.adi) as customer_name,
                MAX(a.actar) as tarih,
                MAX(a.acsaat) as acilis_saati
            FROM ads_acik a
            LEFT JOIN personel p ON a.sip_ekleyen = p.id
            LEFT JOIN ads_musteri m ON a.mustid = m.id
            WHERE a.kasa = $1 ${typeCondition}
            GROUP BY a.adsno, a.sipyer
            ORDER BY a.adsno DESC
        `;
        const rows = await this.db.executeQuery(pool, query, [kasa_no]);
        return rows;
    } else {
        if (period === 'all') {
            const query = `
                SELECT 
                    o.adsno,
                    MAX(COALESCE(o.adtur, 0)) as adtur,
                    MAX(COALESCE(a.masano, 0)) as masano,
                    CASE 
                      WHEN MAX(COALESCE(a.masano, 0)) = 99999 THEN 'Paket'
                      ELSE 'Adisyon'
                    END as type_label,
                    SUM(COALESCE(o.otutar, 0)) as tutar,
                    MAX(p.adi) as garson,
                    MAX(o.raptar) as tarih
                FROM ads_odeme o
                LEFT JOIN ads_adisyon a ON o.adsno = a.adsno
                LEFT JOIN personel p ON a.garsonno = p.id
                WHERE o.kasa = $1 ${typeCondition}
                GROUP BY o.adsno
                ORDER BY o.adsno DESC
            `;
            const rows = await this.db.executeQuery(pool, query, [kasa_no]);
            return rows;
        } else {
            const query = `
                SELECT 
                    o.adsno,
                    MAX(COALESCE(o.adtur, 0)) as adtur,
                    MAX(COALESCE(a.masano, 0)) as masano,
                    CASE 
                      WHEN MAX(COALESCE(a.masano, 0)) = 99999 THEN 'Paket'
                      ELSE 'Adisyon'
                    END as type_label,
                    SUM(COALESCE(o.otutar, 0)) as tutar,
                    MAX(p.adi) as garson,
                    MAX(o.raptar) as tarih
                FROM ads_odeme o
                LEFT JOIN ads_adisyon a ON o.adsno = a.adsno
                LEFT JOIN personel p ON a.garsonno = p.id
                WHERE DATE(o.raptar) BETWEEN $1 AND $2 AND o.kasa = $3 ${typeCondition}
                GROUP BY o.adsno
                ORDER BY o.adsno DESC
            `;
            const rows = await this.db.executeQuery(pool, query, [dStart, dEnd, kasa_no]);
            return rows;
        }
    }
  }

  async getOrderDetails(user: any, adsno: string, status: 'open' | 'closed', date?: string, adtur?: number) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);

    if (status === 'open') {
        const query = `
            SELECT 
                a.adsno,
                CAST(a.sipyer AS INTEGER) as sipyer,
                MAX(COALESCE(a.masano, 0)) as masano,
                MAX(COALESCE(a.masano, 0)) as masa_no,
                MAX(COALESCE(a.adtur, 0)) as adtur,
                CASE 
                  WHEN CAST(a.sipyer AS INTEGER) = 2 THEN 'Paket'
                  WHEN CAST(a.sipyer AS INTEGER) = 1 AND MAX(COALESCE(a.masano, 0)) = 99999 THEN 'Hızlı Satış'
                  WHEN CAST(a.sipyer AS INTEGER) = 1 AND MAX(COALESCE(a.masano, 0)) < 99999 THEN 'Adisyon'
                  ELSE 'Diğer'
                END as type_label,
                MAX(p.adi) as garson,
                MAX(m.adi) as customer_name,
                MAX(a.actar) as tarih,
                MAX(a.acsaat) as acilis_saati,
                NULL as kapanis_saati,
                SUM(COALESCE(a.tutar, 0)) as toplam_tutar,
                SUM(COALESCE(a.iskonto, 0)) as toplam_iskonto,
                NULL as toplam_otutar,
                NULL as payment_name,
                (SELECT ss.adi FROM ads_sipyer ss WHERE ss.id = MAX(CAST(a.sipyer AS INTEGER))) as sipyer_name,
                json_agg(json_build_object(
                    'product_name', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                    'quantity', COALESCE(a.miktar, 1),
                    'price', a.bfiyat,
                    'total', a.tutar,
                    'ack1', a.ack1,
                    'ack2', a.ack2,
                    'ack3', a.ack3,
                    'sturu', a.sturu
                )) as items
            FROM ads_acik a
            LEFT JOIN personel p ON a.sip_ekleyen = p.id
            LEFT JOIN ads_musteri m ON a.mustid = m.id
            LEFT JOIN product pr ON a.pluid = pr.plu
            WHERE a.kasa = $1 AND a.adsno = $2 ${typeof adtur !== 'undefined' ? 'AND a.adtur = $3' : ''}
            GROUP BY a.adsno, a.sipyer
        `;
        const rows = await this.db.executeQuery(pool, query, typeof adtur !== 'undefined' ? [kasa_no, adsno, adtur] : [kasa_no, adsno]);
        return rows[0] || null;
    } else {
        const query = `
            WITH ad AS (
                SELECT 
                    adsno,
                    MAX(COALESCE(masano, 0)) as masano,
                    MAX(acsaat) as acsaat,
                    MAX(kapsaat) as kapsaat,
                    MAX(CAST(sipyer AS INTEGER)) as sipyer,
                    MAX(garsonno) as garsonno,
                    MAX(COALESCE(adtur, 0)) as adtur
                FROM ads_adisyon
                WHERE kasa = $1 AND adsno = $2 ${typeof adtur !== 'undefined' ? 'AND adtur = $3' : ''}
                GROUP BY adsno
            ),
            items AS (
                SELECT 
                    COALESCE(json_agg(json_build_object(
                        'product_name', COALESCE(p.product_name, CAST(a.pluid AS VARCHAR)),
                        'quantity', a.miktar,
                        'price', a.bfiyat,
                        'total', a.tutar,
                        'ack1', a.ack1,
                        'ack2', a.ack2,
                        'ack3', a.ack3,
                        'sturu', a.sturu,
                        'pluid', a.pluid,
                        'adtur', a.adtur
                    )), '[]'::json) as items
                FROM ads_adisyon a
                LEFT JOIN product p ON a.pluid = p.plu
                WHERE a.kasa = $1 AND a.adsno = $2 ${typeof adtur !== 'undefined' ? 'AND a.adtur = $3' : ''}
            )
            SELECT
                ad.adsno,
                ad.adtur as adtur,
                ad.masano as masano,
                ad.masano as masa_no,
                CASE WHEN ad.masano = 99999 THEN 'Paket' ELSE 'Adisyon' END as type_label,
                MAX(p.adi) as garson,
                MAX(m.adi) as customer_name,
                COALESCE(MAX(o.raptar), NULL) as tarih,
                ad.acsaat as acilis_saati,
                ad.kapsaat as kapanis_saati,
                COALESCE(SUM(o.iskonto), 0) as toplam_iskonto,
                COALESCE(SUM(o.otutar), 0) as toplam_tutar,
                COALESCE(MAX(od.odmname), NULL) as payment_name,
                (SELECT ss.adi FROM ads_sipyer ss WHERE ss.id = ad.sipyer) as sipyer_name,
                (SELECT items FROM items) as items
            FROM ad
            LEFT JOIN ads_odeme o ON o.adsno = ad.adsno AND o.kasa = $1
            LEFT JOIN personel p ON ad.garsonno = p.id
            LEFT JOIN ads_musteri m ON o.mustid = m.id
            LEFT JOIN ads_odmsekli od ON o.otip = od.odmno
            GROUP BY ad.adsno, ad.masano, ad.acsaat, ad.kapsaat, ad.sipyer, ad.adtur
        `;
        const rows = await this.db.executeQuery(pool, query, typeof adtur !== 'undefined' ? [kasa_no, adsno, adtur] : [kasa_no, adsno]);
        return rows[0] || null;
    }
  }

  async getDashboard(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    
    // Format dates for Postgres
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    // 1. Acik Adisyonlar
    const acikQuery = `
      WITH acik_toplam AS (
          SELECT 
              adsno,
              MAX(COALESCE(adtur, CASE WHEN sipyer = 2 THEN 1 ELSE 0 END)) AS adtur,
              SUM(COALESCE(tutar, 0)) AS adsno_toplam
          FROM ads_acik
          WHERE kasa = ANY($1)
          GROUP BY adsno
      )
      SELECT 
          adtur,
          COUNT(DISTINCT adsno) AS adet,
          COALESCE(SUM(adsno_toplam), 0) AS toplam
      FROM acik_toplam
      GROUP BY adtur
    `;
    const acikRows = await this.db.executeQuery(pool, acikQuery, [kasa_nos]);

    let acik_paket = { adet: 0, toplam: 0 };
    let acik_adisyon = { adet: 0, toplam: 0 };
    let acik_hizli = { adet: 0, toplam: 0 }; // Added hizli

    acikRows.forEach(row => {
      if (parseInt(row.adtur) === 1) acik_paket = { adet: parseInt(row.adet), toplam: parseFloat(row.toplam) };
      else acik_adisyon = { adet: parseInt(row.adet), toplam: parseFloat(row.toplam) };
    });

    // 2. Kapali Adisyonlar (ads_odeme üzerinden adtur ile)
    const kapaliQuery = `
      WITH kapali_toplam AS (
          SELECT 
              o.adsno,
              MAX(COALESCE(o.adtur, CASE WHEN am.masano = 99999 THEN 1 ELSE 0 END)) AS adtur,
              SUM(COALESCE(o.otutar, 0)) AS otutar_sum,
              SUM(COALESCE(o.iskonto, 0)) AS iskonto_sum
          FROM ads_odeme o
          LEFT JOIN (
              SELECT adsno, MAX(COALESCE(masano, 0)) as masano
              FROM ads_adisyon
              WHERE kasa = ANY($1)
              GROUP BY adsno
          ) am ON o.adsno = am.adsno
          WHERE DATE(o.raptar) BETWEEN $2 AND $3 AND o.kasa = ANY($4)
          GROUP BY o.adsno
      )
      SELECT 
          adtur,
          COUNT(DISTINCT adsno) as adet,
          COALESCE(SUM(otutar_sum), 0) as toplam,
          COALESCE(SUM(iskonto_sum), 0) as iskonto
      FROM kapali_toplam
      GROUP BY adtur
    `;
    const kapaliRows = await this.db.executeQuery(pool, kapaliQuery, [kasa_nos, dStart, dEnd, kasa_nos]);

    let kapali_paket = { adet: 0, toplam: 0, iskonto: 0 };
    let kapali_adisyon = { adet: 0, toplam: 0, iskonto: 0 };
    let kapali_hizli = { adet: 0, toplam: 0, iskonto: 0 };
    kapaliRows.forEach((row: any) => {
      const t = parseInt(row.adtur);
      if (t === 1) kapali_paket = { adet: parseInt(row.adet), toplam: parseFloat(row.toplam), iskonto: parseFloat(row.iskonto) };
      else if (t === 3) kapali_hizli = { adet: parseInt(row.adet), toplam: parseFloat(row.toplam), iskonto: parseFloat(row.iskonto) };
      else kapali_adisyon = { adet: parseInt(row.adet), toplam: parseFloat(row.toplam), iskonto: parseFloat(row.iskonto) };
    });

    // 3. Iptal
    const iptalQuery = `
      SELECT COUNT(*) as adet, COALESCE(SUM(tutar), 0) as toplam
      FROM ads_iptal
      WHERE DATE(tarih_saat) BETWEEN $1 AND $2
    `;
    const iptalRows = await this.db.executeQuery(pool, iptalQuery, [dStart, dEnd]);
    const iptal = iptalRows[0] || { adet: 0, toplam: 0 };

    // Totals
    const acik_toplam = acik_paket.toplam + acik_adisyon.toplam;
    const kapali_toplam = kapali_paket.toplam + kapali_adisyon.toplam + kapali_hizli.toplam;
    const kapali_iskonto_toplam = kapali_paket.iskonto + kapali_adisyon.iskonto;

    return {
      acik_adisyon_toplam: acik_toplam,
      kapali_adisyon_toplam: kapali_toplam,
      kapali_iskonto_toplam: kapali_iskonto_toplam,
      iptal_toplam: parseFloat(iptal.toplam),
      acik_adisyon_adet: acik_paket.adet + acik_adisyon.adet,
      kapali_adisyon_adet: kapali_paket.adet + kapali_adisyon.adet,
      iptal_adet: parseInt(iptal.adet),
      dagilim: {
        paket: {
          acik_adet: acik_paket.adet,
          acik_toplam: acik_paket.toplam,
          kapali_adet: kapali_paket.adet,
          kapali_toplam: kapali_paket.toplam,
          kapali_iskonto: kapali_paket.iskonto,
          toplam_adet: acik_paket.adet + kapali_paket.adet,
          toplam_tutar: acik_paket.toplam + kapali_paket.toplam,
          acik_yuzde: acik_toplam > 0 ? Math.round((acik_paket.toplam / acik_toplam) * 100) : 0,
          kapali_yuzde: kapali_toplam > 0 ? Math.round((kapali_paket.toplam / kapali_toplam) * 100) : 0
        },
        adisyon: {
          acik_adet: acik_adisyon.adet,
          acik_toplam: acik_adisyon.toplam,
          kapali_adet: kapali_adisyon.adet,
          kapali_toplam: kapali_adisyon.toplam,
          kapali_iskonto: kapali_adisyon.iskonto,
          toplam_adet: acik_adisyon.adet + kapali_adisyon.adet,
          toplam_tutar: acik_adisyon.toplam + kapali_adisyon.toplam,
          acik_yuzde: acik_toplam > 0 ? Math.round((acik_adisyon.toplam / acik_toplam) * 100) : 0,
          kapali_yuzde: kapali_toplam > 0 ? Math.round((kapali_adisyon.toplam / kapali_toplam) * 100) : 0
        },
        hizli: {
          acik_adet: 0,
          acik_toplam: 0,
          kapali_adet: kapali_hizli.adet,
          kapali_toplam: kapali_hizli.toplam,
          kapali_iskonto: kapali_hizli.iskonto,
          toplam_adet: kapali_hizli.adet,
          toplam_tutar: kapali_hizli.toplam,
          kapali_yuzde: kapali_toplam > 0 ? Math.round((kapali_hizli.toplam / kapali_toplam) * 100) : 0
        }
      }
    };
  }


  async getSalesChart(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    const query = `
      SELECT 
          DATE(kaptar) as tarih,
          SUM(COALESCE(tutar, 0)) as toplam
      FROM ads_adisyon
      WHERE kaptar BETWEEN $1 AND $2 AND kasa = ANY($3)
      GROUP BY DATE(kaptar)
      ORDER BY DATE(kaptar)
    `;
    
    const rows = await this.db.executeQuery(pool, query, [dStart, dEnd, kasa_nos]);
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

  async getProductSales(user: any, period: string, startDate?: string, endDate?: string, groupId?: number) {
    const { pool, kasa_no, kasa_nos } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    let query = '';
    const params = [];

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
                COALESCE(SUM(cs.miktar), 0) as quantity,
                COALESCE(SUM(cs.tutar), 0) as total
            FROM combined_sales cs
            LEFT JOIN product p ON cs.pluid = p.plu
            ${groupId ? 'WHERE p.tip = $7' : ''}
            GROUP BY p.product_name
            ORDER BY total DESC
        `;
        params.push(dStart, dEnd, kasa_nos, dStart, dEnd, kasa_nos);
        if (groupId) params.push(groupId);
    } else {
        // Only Closed
        query = `
            SELECT 
                p.product_name as product_name,
                COALESCE(SUM(a.miktar), 0) as quantity,
                COALESCE(SUM(a.tutar), 0) as total
            FROM ads_adisyon a
            LEFT JOIN product p ON a.pluid = p.plu
            WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = ANY($3)
            ${groupId ? 'AND p.tip = $4' : ''}
            GROUP BY p.product_name
            ORDER BY total DESC
        `;
        params.push(dStart, dEnd, kasa_nos);
        if (groupId) params.push(groupId);
    }

    const rows = await this.db.executeQuery(pool, query, params);
    return rows;
  }

  async getProductGroups(user: any) {
    const { pool } = await this.getBranchPool(user);
    const q = `
      SELECT id, adi as name
      FROM product_group
      ORDER BY adi ASC
    `;
    return this.db.executeQuery(pool, q, []);
  }
}
