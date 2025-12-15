import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BranchesService {
  constructor(private db: DatabaseService) {}

  async findAll(userId: string) {
    const pool = this.db.getMainPool();
    const query = 'SELECT * FROM branches WHERE user_id = $1';
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
    return res[0];
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
    return res[0];
  }

  async remove(userId: string, id: number) {
    const pool = this.db.getMainPool();
    const query = 'DELETE FROM branches WHERE id = $1 AND user_id = $2 RETURNING id';
    const res = await this.db.executeQuery(pool, query, [id, userId]);
    return res[0];
  }
}
