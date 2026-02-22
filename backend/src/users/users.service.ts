import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async findOne(email: string): Promise<any> {
    const pool = this.db.getMainPool();
    const cleanEmail = email.trim().toLowerCase();

    const res = await pool.query(
      `
      SELECT *, 
             EXTRACT(DAY FROM (expiry_date - CURRENT_DATE))::INTEGER as days_left
      FROM users 
      WHERE LOWER(email) = $1
    `,
      [cleanEmail],
    );
    if (res.rows.length === 0) return null;

    const user = res.rows[0];

    // If allowed_reports is NULL, it means ALL allowed.
    // We don't need to change anything here because the frontend/mobile logic handles NULL as "All Allowed".
    // But if you want to be explicit, we can return a full list here.
    // However, keeping it NULL in DB is better for future updates (new reports automatically allowed).

    // Fetch branches
    const branchesRes = await pool.query(
      'SELECT * FROM branches WHERE user_id = $1',
      [user.id],
    );
    user.branches = branchesRes.rows;
    return user;
  }

  async create(userData: any): Promise<any> {
    const pool = this.db.getMainPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const expiryDays = Number.isFinite(userData?.expiry_days)
        ? Number(userData.expiry_days)
        : 30;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);
      const isAdmin = !!userData?.is_admin;
      const allowedReports = userData.allowed_reports || null;

      const userRes = await client.query(
        'INSERT INTO users (email, password, selected_branch, expiry_date, is_admin, allowed_reports) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [
          userData.email,
          userData.password,
          0,
          expiryDate,
          isAdmin,
          allowedReports,
        ],
      );
      const user = userRes.rows[0];

      if (userData.branches && userData.branches.length > 0) {
        for (const branch of userData.branches) {
          const rawClosing = (branch as any).closing_hour;
          const closingHour =
            typeof rawClosing === 'number'
              ? rawClosing
              : typeof rawClosing === 'string'
                ? parseInt(rawClosing, 10)
                : 6;
          await client.query(
            'INSERT INTO branches (user_id, name, db_host, db_port, db_name, db_user, db_password, kasa_no, closing_hour) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [
              user.id,
              branch.name,
              branch.db_host,
              branch.db_port,
              branch.db_name,
              branch.db_user,
              branch.db_password,
              branch.kasa_no || 1,
              Number.isFinite(closingHour) ? closingHour : 6,
            ],
          );
        }
      }

      await client.query('COMMIT');

      user.branches = userData.branches; // Return with branches
      return user;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async updateSelectedBranch(userId: string, branchIndex: number) {
    const pool = this.db.getMainPool();
    await pool.query('UPDATE users SET selected_branch = $1 WHERE id = $2', [
      branchIndex,
      userId,
    ]);
  }

  async findAll(): Promise<any[]> {
    const pool = this.db.getMainPool();
    const res = await pool.query(`
      SELECT *,
             EXTRACT(DAY FROM (expiry_date - CURRENT_DATE))::INTEGER as days_left
      FROM users
      ORDER BY created_at DESC
    `);
    return res.rows;
  }

  async update(userId: string, data: any): Promise<any> {
    const pool = this.db.getMainPool();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (data.email) {
      fields.push(`email = $${idx++}`);
      values.push(data.email);
    }
    if (typeof data.selected_branch === 'number') {
      fields.push(`selected_branch = $${idx++}`);
      values.push(data.selected_branch);
    }
    if (data.allowed_reports) {
      fields.push(`allowed_reports = $${idx++}`);
      values.push(data.allowed_reports);
    }
    if (data.expiry_date) {
      fields.push(`expiry_date = $${idx++}`);
      values.push(new Date(data.expiry_date));
    }
    if (typeof data.is_admin === 'boolean') {
      fields.push(`is_admin = $${idx++}`);
      values.push(!!data.is_admin);
    }
    if (fields.length === 0) {
      const res = await pool.query('SELECT * FROM users WHERE id = $1', [
        userId,
      ]);
      return res.rows[0];
    }
    values.push(userId);
    const res = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return res.rows[0];
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const pool = this.db.getMainPool();
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [
      hash,
      userId,
    ]);
  }

  async remove(userId: string): Promise<void> {
    const pool = this.db.getMainPool();
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  async extendExpiry(userId: string, days: number): Promise<any> {
    const pool = this.db.getMainPool();
    const d = Number.isFinite(days) ? Number(days) : 30;
    const res = await pool.query(
      `UPDATE users 
       SET expiry_date = (CASE 
         WHEN expiry_date IS NULL OR expiry_date < CURRENT_DATE 
         THEN CURRENT_DATE 
         ELSE expiry_date 
       END) + ($1::int || ' days')::interval
       WHERE id = $2
       RETURNING *`,
      [d, userId],
    );
    return res.rows[0];
  }

  async checkConnection(): Promise<any> {
    try {
      const pool = this.db.getMainPool();
      const client = await pool.connect();

      // Check DB connection
      const timeRes = await client.query('SELECT NOW() as now');

      // Check User
      const userRes = await client.query(
        "SELECT id, email FROM users WHERE email = 'selcuk.yilmaz@microvise.net'",
      );

      client.release();

      return {
        status: 'ok',
        db_time: timeRes.rows[0].now,
        user_found: userRes.rows.length > 0,
        user: userRes.rows[0] || null,
        env_host: process.env.DB_HOST, // Show which host is being used
        env_ssl: process.env.DB_SSL,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        stack: error.stack,
        env_host: process.env.DB_HOST,
      };
    }
  }
}
