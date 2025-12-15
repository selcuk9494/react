import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async findOne(email: string): Promise<any> {
    const pool = this.db.getMainPool();
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (res.rows.length === 0) return null;
    
    const user = res.rows[0];
    // Fetch branches
    const branchesRes = await pool.query('SELECT * FROM branches WHERE user_id = $1', [user.id]);
    user.branches = branchesRes.rows;
    return user;
  }

  async create(userData: any): Promise<any> {
    const pool = this.db.getMainPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const userRes = await client.query(
        'INSERT INTO users (email, password, selected_branch) VALUES ($1, $2, $3) RETURNING *',
        [userData.email, userData.password, 0]
      );
      const user = userRes.rows[0];

      if (userData.branches && userData.branches.length > 0) {
        for (const branch of userData.branches) {
          await client.query(
            'INSERT INTO branches (user_id, name, db_host, db_port, db_name, db_user, db_password, kasa_no) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [user.id, branch.name, branch.db_host, branch.db_port, branch.db_name, branch.db_user, branch.db_password, branch.kasa_no || 1]
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
    await pool.query('UPDATE users SET selected_branch = $1 WHERE id = $2', [branchIndex, userId]);
  }
}
