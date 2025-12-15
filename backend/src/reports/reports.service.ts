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

    return {
      pool: this.db.getBranchPool({
        db_host: branch.db_host,
        db_port: branch.db_port,
        db_name: branch.db_name,
        db_user: branch.db_user,
        db_password: this.decryptPassword(branch.db_password),
      }),
      kasa_no: branch.kasa_no || 1
    };
  }

  async getOrders(user: any, period: string, status: 'open' | 'closed', startDate?: string, endDate?: string, type?: 'adisyon' | 'paket') {
    const { pool, kasa_no } = await this.getBranchPool(user);
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
                MAX(COALESCE(a.masano, 0)) as masano,
                SUM(COALESCE(a.tutar, 0)) as tutar,
                MAX(p.adi) as garson,
                MAX(a.actar) as tarih
            FROM ads_acik a
            LEFT JOIN personel p ON a.garsonno = p.id
            WHERE a.kasa = $1 ${typeCondition}
            GROUP BY a.adsno
            ORDER BY a.adsno DESC
        `;
        const rows = await this.db.executeQuery(pool, query, [kasa_no]);
        return rows;
    } else {
        const query = `
            SELECT 
                o.adsno,
                MAX(COALESCE(a.masano, 0)) as masano,
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

  async getOrderDetails(user: any, adsno: string, status: 'open' | 'closed', date: string) {
    const { pool, kasa_no } = await this.getBranchPool(user);

    if (status === 'open') {
        const query = `
            SELECT 
                a.adsno,
                MAX(COALESCE(a.masano, 0)) as masano,
                MAX(p.adi) as garson,
                MAX(a.actar) as tarih,
                SUM(COALESCE(a.tutar, 0)) as toplam_tutar,
                json_agg(json_build_object(
                    'product_name', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                    'quantity', a.miktar,
                    'price', a.tutar,
                    'total', a.tutar
                )) as items
            FROM ads_acik a
            LEFT JOIN personel p ON a.garsonno = p.id
            LEFT JOIN product pr ON a.pluid = pr.plu
            WHERE a.kasa = $1 AND a.adsno = $2
            GROUP BY a.adsno
        `;
        const rows = await this.db.executeQuery(pool, query, [kasa_no, adsno]);
        return rows[0] || null;
    } else {
        const query = `
            SELECT 
                o.adsno,
                MAX(COALESCE(a.masano, 0)) as masano,
                MAX(p.adi) as garson,
                MAX(o.raptar) as tarih,
                SUM(COALESCE(o.otutar, 0)) as toplam_tutar,
                json_agg(json_build_object(
                    'product_name', COALESCE(pr.product_name, CAST(a.pluid AS VARCHAR)),
                    'quantity', a.miktar,
                    'price', a.tutar,
                    'total', a.tutar
                )) as items
            FROM ads_odeme o
            LEFT JOIN ads_adisyon a ON o.adsno = a.adsno
            LEFT JOIN personel p ON a.garsonno = p.id
            LEFT JOIN product pr ON a.pluid = pr.plu
            WHERE o.kasa = $1 AND o.adsno = $2
            GROUP BY o.adsno
        `;
        const rows = await this.db.executeQuery(pool, query, [kasa_no, adsno]);
        return rows[0] || null;
    }
  }

  async getDashboard(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    
    // Format dates for Postgres
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    // 1. Acik Adisyonlar
    const acikQuery = `
      WITH acik_toplam AS (
          SELECT 
              adsno,
              MAX(COALESCE(masano, 0)) as masano,
              SUM(COALESCE(tutar, 0)) as adsno_toplam
          FROM ads_acik
          WHERE kasa = $1
          GROUP BY adsno
      )
      SELECT 
          CASE WHEN masano = 99999 THEN 'paket' ELSE 'adisyon' END as tip,
          COUNT(DISTINCT adsno) as adet,
          COALESCE(SUM(adsno_toplam), 0) as toplam
      FROM acik_toplam
      GROUP BY tip
    `;
    const acikRows = await this.db.executeQuery(pool, acikQuery, [kasa_no]);

    let acik_paket = { adet: 0, toplam: 0 };
    let acik_adisyon = { adet: 0, toplam: 0 };
    acikRows.forEach(row => {
      if (row.tip === 'paket') acik_paket = { adet: parseInt(row.adet), toplam: parseFloat(row.toplam) };
      else acik_adisyon = { adet: parseInt(row.adet), toplam: parseFloat(row.toplam) };
    });

    // 2. Kapali Adisyonlar
    const kapaliQuery = `
      WITH adsno_masano AS (
          SELECT DISTINCT adsno, MAX(COALESCE(masano, 0)) as masano
          FROM ads_adisyon
          WHERE kasa = $1
          GROUP BY adsno
      )
      SELECT 
          CASE WHEN am.masano = 99999 THEN 'paket' ELSE 'adisyon' END as tip,
          COUNT(DISTINCT o.adsno) as adet,
          COALESCE(SUM(o.otutar), 0) as toplam,
          COALESCE(SUM(o.iskonto), 0) as iskonto
      FROM ads_odeme o
      LEFT JOIN adsno_masano am ON o.adsno = am.adsno
      WHERE DATE(o.raptar) BETWEEN $2 AND $3 AND o.kasa = $4
      GROUP BY tip
    `;
    const kapaliRows = await this.db.executeQuery(pool, kapaliQuery, [kasa_no, dStart, dEnd, kasa_no]);

    let kapali_paket = { adet: 0, toplam: 0, iskonto: 0 };
    let kapali_adisyon = { adet: 0, toplam: 0, iskonto: 0 };
    kapaliRows.forEach(row => {
      if (row.tip === 'paket') kapali_paket = { adet: parseInt(row.adet), toplam: parseFloat(row.toplam), iskonto: parseFloat(row.iskonto) };
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
    const kapali_toplam = kapali_paket.toplam + kapali_adisyon.toplam;
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
          toplam_tutar: acik_paket.toplam + kapali_paket.toplam
        },
        adisyon: {
          acik_adet: acik_adisyon.adet,
          acik_toplam: acik_adisyon.toplam,
          kapali_adet: kapali_adisyon.adet,
          kapali_toplam: kapali_adisyon.toplam,
          kapali_iskonto: kapali_adisyon.iskonto,
          toplam_adet: acik_adisyon.adet + kapali_adisyon.adet,
          toplam_tutar: acik_adisyon.toplam + kapali_adisyon.toplam
        }
      }
    };
  }

  async getCourierTracking(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    // 1. Open Packets
    const openQuery = `
      SELECT DISTINCT
          a.adsno,
          p.adi as kurye,
          a.gidsaat as cikis,
          a.donsaat as donus,
          a.actar as tarih,
          'open' as status
      FROM ads_acik a
      LEFT JOIN personel p ON a.garsonno = p.id
      WHERE a.kasa = $1 AND a.masano = 99999 AND a.actar BETWEEN $2 AND $3
    `;
    const openRows = await this.db.executeQuery(pool, openQuery, [kasa_no, dStart, dEnd]);

    // 2. Closed Packets
    const closedQuery = `
      SELECT DISTINCT
          a.adsno,
          p.adi as kurye,
          a.motcikis as cikis,
          a.stopsaat as donus,
          a.siptar as tarih,
          'closed' as status
      FROM ads_adisyon a
      LEFT JOIN personel p ON a.garsonno = p.id
      WHERE a.kasa = $1 AND a.masano = 99999 AND a.siptar BETWEEN $2 AND $3
    `;
    const closedRows = await this.db.executeQuery(pool, closedQuery, [kasa_no, dStart, dEnd]);

    const results = [...openRows, ...closedRows];
    
    // Sort logic
    results.sort((a, b) => {
        const da = new Date(a.tarih);
        const db = new Date(b.tarih);
        return db.getTime() - da.getTime(); // Descending
    });

    return results;
  }

  async getSalesChart(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no } = await this.getBranchPool(user);
    const { start, end } = this.getDateRange(period, startDate, endDate);
    const dStart = format(start, 'yyyy-MM-dd');
    const dEnd = format(end, 'yyyy-MM-dd');

    const query = `
      SELECT 
          DATE(kaptar) as tarih,
          SUM(COALESCE(tutar, 0)) as toplam
      FROM ads_adisyon
      WHERE kaptar BETWEEN $1 AND $2 AND kasa = $3
      GROUP BY DATE(kaptar)
      ORDER BY DATE(kaptar)
    `;
    
    const rows = await this.db.executeQuery(pool, query, [dStart, dEnd, kasa_no]);
    return rows.map(row => ({
      tarih: format(row.tarih, 'yyyy-MM-dd'),
      toplam: parseFloat(row.toplam)
    }));
  }

  async getPaymentTypes(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no } = await this.getBranchPool(user);
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
      WHERE DATE(o.raptar) BETWEEN $1 AND $2 AND o.kasa = $3
      GROUP BY od.odmno, od.odmname
      ORDER BY total DESC
    `;
    
    const rows = await this.db.executeQuery(pool, query, [dStart, dEnd, kasa_no]);
    return rows.map(row => ({
      payment_name: row.payment_name,
      total: parseFloat(row.total),
      count: parseInt(row.count),
      otip: row.otip
    }));
  }

  async getCancelledItems(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no } = await this.getBranchPool(user);
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
      WHERE a.actar BETWEEN $1 AND $2 AND a.kasa = $3 AND a.sturu IN (1,2,4)
    `;
    const openRows = await this.db.executeQuery(pool, openQuery, [dStart, dEnd, kasa_no]);

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
      WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = $3 AND a.sturu IN (1,2,4)
    `;
    const closedRows = await this.db.executeQuery(pool, closedQuery, [dStart, dEnd, kasa_no]);

    const results = [...openRows, ...closedRows];
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return results.slice(0, 200);
  }

  async getPerformance(user: any, period: string, startDate?: string, endDate?: string) {
    const { pool, kasa_no } = await this.getBranchPool(user);
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
      WHERE DATE(o.raptar) BETWEEN $1 AND $2 AND o.kasa = $3
    `;
    const totalsRows = await this.db.executeQuery(pool, totalsQuery, [dStart, dEnd, kasa_no]);
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
      WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = $3
      GROUP BY a.adsno
    `;
    const durations = await this.db.executeQuery(pool, durationQuery, [dStart, dEnd, kasa_no]);
    
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
      LEFT JOIN ads_odeme o ON a.adsno = o.adsno AND a.adtur = o.adtur AND o.kasa = $1
      WHERE a.kaptar BETWEEN $2 AND $3 AND a.kasa = $4
      GROUP BY a.garsonno
      ORDER BY total DESC
      LIMIT 10
    `;
    const waiters = await this.db.executeQuery(pool, waitersQuery, [kasa_no, dStart, dEnd, kasa_no]);

    // Products
    const productsQuery = `
      SELECT 
          COALESCE(p.product_name, CAST(a.pluid AS VARCHAR), 'Ürün') as product_name,
          COALESCE(SUM(a.miktar), 0) as quantity,
          COALESCE(SUM(a.tutar), 0) as total
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = $3
      GROUP BY p.product_name, a.pluid
      ORDER BY total DESC
      LIMIT 10
    `;
    const products = await this.db.executeQuery(pool, productsQuery, [dStart, dEnd, kasa_no]);

    // Groups
    const groupsQuery = `
      SELECT 
          pg.adi as group_name,
          COALESCE(SUM(a.miktar), 0) as quantity,
          COALESCE(SUM(a.tutar), 0) as total
      FROM ads_adisyon a
      LEFT JOIN product p ON a.pluid = p.plu
      LEFT JOIN product_group pg ON p.tip = pg.id
      WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = $3
      GROUP BY pg.adi
      ORDER BY total DESC
      LIMIT 10
    `;
    const groups = await this.db.executeQuery(pool, groupsQuery, [dStart, dEnd, kasa_no]);

    const branchIndex = user.selected_branch || 0;
    const branchName = user.branches[branchIndex]?.name || '';

    return {
        branch: { name: branchName, kasa_no },
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
    const { pool, kasa_no } = await this.getBranchPool(user);
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
                WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = $3
                UNION ALL
                SELECT a.pluid, a.miktar, a.tutar
                FROM ads_acik a
                WHERE a.actar BETWEEN $4 AND $5 AND a.kasa = $6
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
        params.push(dStart, dEnd, kasa_no, dStart, dEnd, kasa_no);
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
            WHERE a.kaptar BETWEEN $1 AND $2 AND a.kasa = $3
            ${groupId ? 'AND p.tip = $4' : ''}
            GROUP BY p.product_name
            ORDER BY total DESC
        `;
        params.push(dStart, dEnd, kasa_no);
        if (groupId) params.push(groupId);
    }

    const rows = await this.db.executeQuery(pool, query, params);
    return rows;
  }
}
