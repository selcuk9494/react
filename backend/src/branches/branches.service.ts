import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class BranchesService {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
  ) {}

  private normalizeKasalar(data: any): number[] {
    const primary =
      typeof data?.kasa_no === 'number'
        ? data.kasa_no
        : typeof data?.kasa_no === 'string'
          ? parseInt(data.kasa_no, 10)
          : 1;
    const rawKasalar = Array.isArray(data?.kasalar) ? data.kasalar : [];
    return Array.from(
      new Set(
        [primary, ...rawKasalar]
          .map((kasa) =>
            typeof kasa === 'number' ? kasa : parseInt(String(kasa), 10),
          )
          .filter((kasa) => Number.isFinite(kasa) && !isNaN(kasa)),
      ),
    );
  }

  private normalizeText(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizePort(value: any): number {
    const parsed = parseInt(String(value || 5432), 10);
    return Number.isFinite(parsed) ? parsed : 5432;
  }

  private async findDuplicateForUser(userId: string, data: any, excludeBranchId?: number) {
    const pool = this.db.getMainPool();
    const params: any[] = [
      userId,
      this.normalizeText(data?.name),
      this.normalizeText(data?.db_host),
      this.normalizePort(data?.db_port),
      this.normalizeText(data?.db_name),
    ];
    const excludeSql = excludeBranchId ? `AND id <> $6` : '';
    if (excludeBranchId) params.push(excludeBranchId);

    const rows = await this.db.executeQuery(
      pool,
      `SELECT *
       FROM branches
       WHERE user_id = $1
         AND LOWER(TRIM(name)) = $2
         AND LOWER(TRIM(db_host)) = $3
         AND COALESCE(db_port, 5432) = $4
         AND LOWER(TRIM(db_name)) = $5
         ${excludeSql}
       ORDER BY id ASC
       LIMIT 1`,
      params,
    );
    return rows[0] || null;
  }

  async findAll(userId: string) {
    // Try cache first
    const cacheKey = this.cache.generateKey('branches', 'user', userId);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pool = this.db.getMainPool();
    const query = `
      SELECT 
        b.*,
        COALESCE(array_agg(k.kasa_no) FILTER (WHERE k.kasa_no IS NOT NULL), '{}') AS kasalar
      FROM branches b
      LEFT JOIN branch_kasas k ON k.branch_id = b.id
      WHERE b.user_id = $1
      GROUP BY b.id
      ORDER BY b.id
    `;
    const res = await this.db.executeQuery(pool, query, [userId]);

    // Cache for 5 minutes
    await this.cache.set(cacheKey, res, 300);
    return res;
  }

  async findById(id: number) {
    // Try cache first
    const cacheKey = this.cache.generateKey('branches', 'id', id);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pool = this.db.getMainPool();
    const query = `
      SELECT 
        b.*,
        COALESCE(array_agg(k.kasa_no) FILTER (WHERE k.kasa_no IS NOT NULL), '{}') AS kasalar
      FROM branches b
      LEFT JOIN branch_kasas k ON k.branch_id = b.id
      WHERE b.id = $1
      GROUP BY b.id
      LIMIT 1
    `;
    const res = await this.db.executeQuery(pool, query, [id]);
    const branch = res[0];

    // Cache for 10 minutes
    await this.cache.set(cacheKey, branch, 600);
    return branch;
  }

  async findAllGlobal() {
    const pool = this.db.getMainPool();
    const query = `
      SELECT DISTINCT ON (
        LOWER(TRIM(branch_rows.name)),
        LOWER(TRIM(branch_rows.db_host)),
        COALESCE(branch_rows.db_port, 5432),
        LOWER(TRIM(branch_rows.db_name))
      ) *
      FROM (
        SELECT 
          b.*,
          u.email AS owner_email,
          COALESCE(array_agg(k.kasa_no) FILTER (WHERE k.kasa_no IS NOT NULL), '{}') AS kasalar
        FROM branches b
        JOIN users u ON u.id = b.user_id
        LEFT JOIN branch_kasas k ON k.branch_id = b.id
        GROUP BY b.id, u.email
      ) branch_rows
      ORDER BY
        LOWER(TRIM(branch_rows.name)),
        LOWER(TRIM(branch_rows.db_host)),
        COALESCE(branch_rows.db_port, 5432),
        LOWER(TRIM(branch_rows.db_name)),
        branch_rows.id ASC
    `;
    const res = await this.db.executeQuery(pool, query, []);
    return res;
  }

  async create(userId: string, data: any) {
    const pool = this.db.getMainPool();
    const duplicate = await this.findDuplicateForUser(userId, data);
    if (duplicate) {
      return duplicate;
    }
    const query = `
      INSERT INTO branches (user_id, name, db_host, db_port, db_name, db_user, db_password, kasa_no, closing_hour)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const closingHour =
      typeof data.closing_hour === 'number'
        ? data.closing_hour
        : typeof data.closing_hour === 'string'
          ? parseInt(data.closing_hour, 10)
          : 6;
    const params = [
      userId,
      data.name,
      data.db_host,
      data.db_port || 5432,
      data.db_name,
      data.db_user,
      data.db_password,
      data.kasa_no || 1,
      Number.isFinite(closingHour) ? closingHour : 6,
    ];
    const res = await this.db.executeQuery(pool, query, params);
    const branch = res[0];
    for (const kasa of this.normalizeKasalar(data)) {
      await this.db.executeQuery(
        pool,
        'INSERT INTO branch_kasas (branch_id, kasa_no) VALUES ($1, $2)',
        [branch.id, kasa],
      );
    }

    // Invalidate user's branches cache
    await this.cache.del(this.cache.generateKey('branches', 'user', userId));

    return branch;
  }

  async update(userId: string, id: number, data: any) {
    const pool = this.db.getMainPool();
    const duplicate = await this.findDuplicateForUser(userId, data, id);
    if (duplicate) {
      return duplicate;
    }
    const query = `
      UPDATE branches 
      SET name = $1, db_host = $2, db_port = $3, db_name = $4, db_user = $5, db_password = $6, kasa_no = $7, closing_hour = $8
      WHERE id = $9 AND user_id = $10
      RETURNING *
    `;
    const closingHour =
      typeof data.closing_hour === 'number'
        ? data.closing_hour
        : typeof data.closing_hour === 'string'
          ? parseInt(data.closing_hour, 10)
          : 6;
    const params = [
      data.name,
      data.db_host,
      data.db_port || 5432,
      data.db_name,
      data.db_user,
      data.db_password,
      data.kasa_no || 1,
      Number.isFinite(closingHour) ? closingHour : 6,
      id,
      userId,
    ];
    const res = await this.db.executeQuery(pool, query, params);
    const branch = res[0];
    await this.db.executeQuery(
      pool,
      'DELETE FROM branch_kasas WHERE branch_id = $1',
      [id],
    );
    for (const kasa of this.normalizeKasalar(data)) {
      await this.db.executeQuery(
        pool,
        'INSERT INTO branch_kasas (branch_id, kasa_no) VALUES ($1, $2)',
        [id, kasa],
      );
    }

    // Invalidate caches
    await this.cache.del(this.cache.generateKey('branches', 'user', userId));
    await this.cache.del(this.cache.generateKey('branches', 'id', id));

    return branch;
  }

  async remove(userId: string, id: number) {
    const pool = this.db.getMainPool();
    const query =
      'DELETE FROM branches WHERE id = $1 AND user_id = $2 RETURNING id';
    const res = await this.db.executeQuery(pool, query, [id, userId]);

    // Invalidate caches
    await this.cache.del(this.cache.generateKey('branches', 'user', userId));
    await this.cache.del(this.cache.generateKey('branches', 'id', id));

    return res[0];
  }

  async copyToUser(targetUserId: string, sourceBranchId: number) {
    const src = await this.findById(sourceBranchId);
    if (!src) return null;
    const data = {
      name: src.name,
      db_host: src.db_host,
      db_port: src.db_port,
      db_name: src.db_name,
      db_user: src.db_user,
      db_password: src.db_password,
      kasa_no: src.kasa_no,
      closing_hour: (src as any).closing_hour,
      kasalar: Array.isArray(src.kasalar) ? src.kasalar : [],
    };
    return this.create(targetUserId, data);
  }
}
