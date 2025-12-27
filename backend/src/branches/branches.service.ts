import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class BranchesService {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
  ) {}

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
      SELECT 
        b.*,
        u.email AS owner_email,
        COALESCE(array_agg(k.kasa_no) FILTER (WHERE k.kasa_no IS NOT NULL), '{}') AS kasalar
      FROM branches b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN branch_kasas k ON k.branch_id = b.id
      GROUP BY b.id, u.email
      ORDER BY b.id
    `;
    const res = await this.db.executeQuery(pool, query, []);
    return res;
  }

  async create(userId: string, data: any) {
    const pool = this.db.getMainPool();
    const query = `
      INSERT INTO branches (user_id, name, db_host, db_port, db_name, db_user, db_password, kasa_no)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const params = [
      userId,
      data.name,
      data.db_host,
      data.db_port || 5432,
      data.db_name,
      data.db_user,
      data.db_password,
      data.kasa_no || 1
    ];
    const res = await this.db.executeQuery(pool, query, params);
    const branch = res[0];
    if (Array.isArray(data.kasalar)) {
      for (const kasa of data.kasalar) {
        if (typeof kasa === 'number' && !isNaN(kasa)) {
          await this.db.executeQuery(pool, 'INSERT INTO branch_kasas (branch_id, kasa_no) VALUES ($1, $2)', [branch.id, kasa]);
        }
      }
    }
    
    // Invalidate user's branches cache
    await this.cache.del(this.cache.generateKey('branches', 'user', userId));
    
    return branch;
  }

  async update(userId: string, id: number, data: any) {
    const pool = this.db.getMainPool();
    const query = `
      UPDATE branches 
      SET name = $1, db_host = $2, db_port = $3, db_name = $4, db_user = $5, db_password = $6, kasa_no = $7
      WHERE id = $8 AND user_id = $9
      RETURNING *
    `;
    const params = [
      data.name,
      data.db_host,
      data.db_port || 5432,
      data.db_name,
      data.db_user,
      data.db_password,
      data.kasa_no || 1,
      id,
      userId
    ];
    const res = await this.db.executeQuery(pool, query, params);
    const branch = res[0];
    await this.db.executeQuery(pool, 'DELETE FROM branch_kasas WHERE branch_id = $1', [id]);
    if (Array.isArray(data.kasalar)) {
      for (const kasa of data.kasalar) {
        if (typeof kasa === 'number' && !isNaN(kasa)) {
          await this.db.executeQuery(pool, 'INSERT INTO branch_kasas (branch_id, kasa_no) VALUES ($1, $2)', [id, kasa]);
        }
      }
    }
    
    // Invalidate caches
    await this.cache.del(this.cache.generateKey('branches', 'user', userId));
    await this.cache.del(this.cache.generateKey('branches', 'id', id));
    
    return branch;
  }

  async remove(userId: string, id: number) {
    const pool = this.db.getMainPool();
    const query = 'DELETE FROM branches WHERE id = $1 AND user_id = $2 RETURNING id';
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
      kasalar: Array.isArray(src.kasalar) ? src.kasalar : [],
    };
    return this.create(targetUserId, data);
  }
}
