import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BranchesService {
  constructor(private db: DatabaseService) {}

  async findAll(userId: string) {
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
    return branch;
  }

  async remove(userId: string, id: number) {
    const pool = this.db.getMainPool();
    const query = 'DELETE FROM branches WHERE id = $1 AND user_id = $2 RETURNING id';
    const res = await this.db.executeQuery(pool, query, [id, userId]);
    return res[0];
  }
}
