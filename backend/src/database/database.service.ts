import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private mainPool: Pool;
  private branchPools: Map<string, Pool> = new Map();
  private isMock = false;

  constructor(private configService: ConfigService) {}

  isMockMode(): boolean {
    return this.isMock;
  }

  async onModuleInit() {
    this.mainPool = new Pool({
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      user: this.configService.get<string>('DB_USER', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'postgres'),
      database: this.configService.get<string>('DB_NAME', 'micrapor_users'),
      // Optimized pool settings
      max: 20, // Maximum pool size
      min: 2, // Minimum pool size
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Wait 5s for connection
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // Enable prepared statements for better performance
      statement_timeout: 30000, // 30s query timeout
      ssl: this.configService.get<string>('DB_HOST', '').includes('render.com')
        ? { rejectUnauthorized: false }
        : false,
    });

    try {
      // Test connection
      const client = await this.mainPool.connect();
      client.release();
      await this.initSchema();
      await this.ensureSeedAdmins();
      console.log('Connected to PostgreSQL successfully.');
    } catch (e) {
      console.warn('Failed to connect to PostgreSQL, switching to MOCK mode.');
      console.warn('Error:', e.message);
      this.isMock = true;
    }
  }

  async onModuleDestroy() {
    if (!this.isMock) {
      await this.mainPool.end();
      for (const pool of this.branchPools.values()) {
        await pool.end();
      }
    }
  }

  private async initSchema() {
    const client = await this.mainPool.connect();
    try {
      // Ensure pgcrypto extension exists for gen_random_uuid() (Required for older Postgres versions like 9.4)
      await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          selected_branch INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const colCheck = async (col: string) => {
        const r = await client.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name=$1`,
          [col],
        );
        return r.rows.length > 0;
      };
      const hasExpiry = await colCheck('expiry_date');
      if (!hasExpiry) {
        await client.query(
          `ALTER TABLE users ADD COLUMN expiry_date TIMESTAMP`,
        );
      }
      const hasAdmin = await colCheck('is_admin');
      if (!hasAdmin) {
        await client.query(
          `ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE`,
        );
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS branches (
          id SERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          db_host VARCHAR(255) NOT NULL,
          db_port INTEGER DEFAULT 5432,
          db_name VARCHAR(255) NOT NULL,
          db_user VARCHAR(255) NOT NULL,
          db_password VARCHAR(255) NOT NULL,
          kasa_no INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const branchColCheck = async (col: string) => {
        const r = await client.query(
          `SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name=$1`,
          [col],
        );
        return r.rows.length > 0;
      };
      const hasClosingHour = await branchColCheck('closing_hour');
      if (!hasClosingHour) {
        await client.query(
          `ALTER TABLE branches ADD COLUMN closing_hour INTEGER DEFAULT 6`,
        );
        await client.query(
          `UPDATE branches SET closing_hour = 6 WHERE closing_hour IS NULL`,
        );
      }
      await client.query(`
        CREATE TABLE IF NOT EXISTS branch_kasas (
          id SERIAL PRIMARY KEY,
          branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
          kasa_no INTEGER NOT NULL
        );
      `);
    } catch (e) {
      console.log(
        'Schema init error (might be okay if tables exist):',
        e.message,
      );
    } finally {
      client.release();
    }
  }

  private async ensureSeedAdmins() {
    if (this.isMock) return;
    const list = (
      this.configService.get<string>('ADMIN_EMAILS') ||
      'selcuk.yilmaz@microvise.net'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    const client = await this.mainPool.connect();
    try {
      await client.query('BEGIN');
      for (const email of list) {
        await client.query(
          `UPDATE users SET is_admin = TRUE WHERE email = $1`,
          [email],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.warn('ensureSeedAdmins error:', e.message);
    } finally {
      client.release();
    }
  }

  getMainPool(): any {
    if (this.isMock) {
      return {
        query: (text: string, params: any[]) => this.mockQuery(text, params),
      };
    }
    return this.mainPool;
  }

  getBranchPool(config: any): any {
    if (this.isMock) return {}; // Return empty object, executeQuery handles it

    const key = `${config.db_host}:${config.db_port}:${config.db_name}:${config.db_user}`;

    if (!this.branchPools.has(key)) {
      const pool = new Pool({
        host: config.db_host,
        port: config.db_port,
        database: config.db_name,
        user: config.db_user,
        password: config.db_password,
        // Optimized settings for branch connections
        max: 10, // Reduced max connections per branch
        min: 1, // Keep 1 connection alive
        idleTimeoutMillis: 60000, // Keep connections longer (60s)
        connectionTimeoutMillis: 8000, // Longer timeout for branch DBs
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        statement_timeout: 45000, // 45s timeout for branch queries
        ssl: config.db_host.includes('render.com')
          ? { rejectUnauthorized: false }
          : false,
      });

      pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });

      this.branchPools.set(key, pool);
    }

    return this.branchPools.get(key);
  }

  async executeQuery(
    pool: any,
    text: string,
    params: any[] = [],
  ): Promise<any> {
    if (this.isMock) {
      const res = await this.mockQuery(text, params);
      return res.rows;
    }

    const client = await pool.connect();
    try {
      const res = await client.query(text, params);
      return res.rows;
    } finally {
      client.release();
    }
  }

  // --- MOCK DATA GENERATOR ---
  private async mockQuery(text: string, params: any[]): Promise<any> {
    const lowerText = text.toLowerCase();

    // 1. User Login / Register
    if (lowerText.includes('from users where email')) {
      const email = params[0];
      if (
        email === 'admin@example.com' ||
        email === 'selcuk.yilmaz@microvise.net'
      ) {
        const hash = await bcrypt.hash('123456', 10);
        return {
          rows: [{ id: 'mock-id', email, password: hash, selected_branch: 0 }],
        };
      }
      return { rows: [] };
    }
    if (lowerText.includes('insert into users')) {
      return {
        rows: [{ id: 'mock-new-id', email: params[0], selected_branch: 0 }],
      };
    }
    if (lowerText.includes('from branches where user_id')) {
      return {
        rows: [
          {
            name: 'Merkez Şube',
            kasa_no: 1,
            db_host: 'mock',
            db_port: 5432,
            db_name: 'mock',
            db_user: 'mock',
            db_password: 'mock',
          },
        ],
      };
    }
    if (lowerText.includes('insert into branches')) {
      return { rows: [] };
    }

    // 2. Dashboard - Acik Adisyonlar
    if (
      lowerText.includes('from ads_acik') &&
      lowerText.includes('acik_toplam')
    ) {
      // Return summary
      return {
        rows: [
          { tip: 'adisyon', adet: '5', toplam: '1250.50' },
          { tip: 'paket', adet: '3', toplam: '850.00' },
        ],
      };
    }

    // 3. Dashboard - Kapali Adisyonlar
    if (
      lowerText.includes('from ads_odeme') &&
      lowerText.includes('kapali_adisyon')
    ) {
      // Wait, query structure might differ
      // My query uses "FROM ads_odeme o" and groups by tip
      return {
        rows: [
          { tip: 'adisyon', adet: '45', toplam: '15400.00', iskonto: '120.00' },
          { tip: 'paket', adet: '20', toplam: '6200.00', iskonto: '50.00' },
        ],
      };
    }

    // Note: The actual query in ReportsService uses WITH clause.
    // "WITH adsno_masano AS ... SELECT ... FROM ads_odeme ..."
    if (lowerText.includes('with adsno_masano as')) {
      return {
        rows: [
          { tip: 'adisyon', adet: '45', toplam: '15400.00', iskonto: '120.00' },
          { tip: 'paket', adet: '20', toplam: '6200.00', iskonto: '50.00' },
        ],
      };
    }

    // 4. Dashboard - Iptal
    if (lowerText.includes('from ads_iptal')) {
      return { rows: [{ adet: '2', toplam: '150.00' }] };
    }

    // 5. Courier Tracking - Open
    if (
      lowerText.includes('from ads_acik') &&
      lowerText.includes('masano = 99999')
    ) {
      return {
        rows: [
          {
            adsno: 101,
            kurye: 'Ahmet Yılmaz',
            cikis: '10:30:00',
            donus: null,
            tarih: new Date().toISOString(),
            status: 'open',
          },
          {
            adsno: 102,
            kurye: 'Mehmet Demir',
            cikis: '11:15:00',
            donus: null,
            tarih: new Date().toISOString(),
            status: 'open',
          },
        ],
      };
    }

    // 6. Courier Tracking - Closed
    if (
      lowerText.includes('from ads_adisyon') &&
      lowerText.includes('masano = 99999')
    ) {
      return {
        rows: [
          {
            adsno: 90,
            kurye: 'Ahmet Yılmaz',
            cikis: '09:00:00',
            donus: '09:45:00',
            tarih: new Date().toISOString(),
            status: 'closed',
          },
          {
            adsno: 95,
            kurye: 'Ali Kaya',
            cikis: '09:30:00',
            donus: '10:10:00',
            tarih: new Date().toISOString(),
            status: 'closed',
          },
        ],
      };
    }

    // 7. Sales Chart
    if (lowerText.includes('date(kaptar) as tarih')) {
      // Generate last 7 days data
      const rows = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        rows.push({
          tarih: d.toISOString().split('T')[0],
          toplam: (Math.random() * 10000 + 5000).toFixed(2),
        });
      }
      return { rows: rows.reverse() };
    }

    // 8. Payment Types
    if (
      lowerText.includes('from ads_odeme') &&
      lowerText.includes('payment_name')
    ) {
      return {
        rows: [
          { payment_name: 'Nakit', total: '8500.00', count: '50', otip: 1 },
          {
            payment_name: 'Kredi Kartı',
            total: '12000.00',
            count: '65',
            otip: 2,
          },
          {
            payment_name: 'Yemek Kartı',
            total: '3000.00',
            count: '15',
            otip: 3,
          },
        ],
      };
    }

    // 9. Cancelled Items - Open
    if (
      lowerText.includes('from ads_acik') &&
      lowerText.includes('sturu in (1,2,4)')
    ) {
      return {
        rows: [
          {
            product_name: 'Çorba',
            quantity: 1,
            reason: 'Soğuk geldi',
            date: new Date().toISOString(),
            order_id: 201,
            adtur: 0,
            waiter_name: 'Ayşe',
            type: 'iade',
            status: 'open',
          },
        ],
      };
    }
    // 10. Cancelled Items - Closed
    if (
      lowerText.includes('from ads_adisyon') &&
      lowerText.includes('sturu in (1,2,4)')
    ) {
      return {
        rows: [
          {
            product_name: 'Kola',
            quantity: 1,
            reason: 'Yanlış sipariş',
            date: new Date().toISOString(),
            order_id: 150,
            adtur: 0,
            waiter_name: 'Fatma',
            type: 'iptal',
            status: 'closed',
          },
          {
            product_name: 'Çay',
            quantity: 2,
            reason: 'İkram',
            date: new Date().toISOString(),
            order_id: 155,
            adtur: 0,
            waiter_name: 'Ali',
            type: 'ikram',
            status: 'closed',
          },
        ],
      };
    }

    // 11. Performance - Totals
    if (
      lowerText.includes('from ads_odeme') &&
      lowerText.includes('total_sales')
    ) {
      return {
        rows: [
          {
            total_sales: '25000.00',
            orders_count: '150',
            total_discount: '450.00',
          },
        ],
      };
    }
    // 12. Performance - Duration
    if (
      lowerText.includes('acilis_saati') &&
      lowerText.includes('kapanis_saati')
    ) {
      return {
        rows: [
          { adsno: 1, acilis_saati: '10:00:00', kapanis_saati: '11:00:00' },
          { adsno: 2, acilis_saati: '12:00:00', kapanis_saati: '12:45:00' },
          { adsno: 3, acilis_saati: '13:00:00', kapanis_saati: '14:30:00' }, // > 60
        ],
      };
    }
    // 13. Performance - Waiters
    if (
      lowerText.includes('from ads_adisyon') &&
      lowerText.includes('waiter_name')
    ) {
      return {
        rows: [
          { waiter_name: 'Ahmet', orders: 40, total: '6000.00' },
          { waiter_name: 'Mehmet', orders: 35, total: '5500.00' },
          { waiter_name: 'Ayşe', orders: 30, total: '4500.00' },
        ],
      };
    }
    // 14. Performance - Products
    if (
      lowerText.includes('from ads_adisyon') &&
      lowerText.includes('group by p.product_name')
    ) {
      return {
        rows: [
          { product_name: 'Adana Kebap', quantity: 50, total: '12500.00' },
          { product_name: 'Lahmacun', quantity: 100, total: '5000.00' },
          { product_name: 'Kola', quantity: 80, total: '2400.00' },
        ],
      };
    }
    // 15. Performance - Groups
    if (
      lowerText.includes('from ads_adisyon') &&
      lowerText.includes('group_name')
    ) {
      return {
        rows: [
          { group_name: 'Kebaplar', quantity: 150, total: '35000.00' },
          { group_name: 'İçecekler', quantity: 200, total: '6000.00' },
        ],
      };
    }

    // 16. Product Sales
    if (lowerText.includes('combined_sales')) {
      return {
        rows: [
          { product_name: 'Adana Kebap', quantity: 55, total: '13750.00' },
          { product_name: 'Urfa Kebap', quantity: 40, total: '10000.00' },
        ],
      };
    }
    // Product Sales (Closed only)
    if (
      lowerText.includes('from ads_adisyon') &&
      lowerText.includes('p.product_name as product_name')
    ) {
      return {
        rows: [
          { product_name: 'Adana Kebap', quantity: 50, total: '12500.00' },
          { product_name: 'Urfa Kebap', quantity: 38, total: '9500.00' },
        ],
      };
    }

    console.log('Unmocked query:', text);
    return { rows: [] };
  }
}
