import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private dbService: DatabaseService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    if (!user) {
        return 'not_found';
    }
    if (await bcrypt.compare(pass, user.password)) {
      if (user.expiry_date) {
        const now = new Date();
        const exp = new Date(user.expiry_date);
        if (exp.getTime() < now.getTime()) {
          return 'expired';
        }
      }
      const { password, ...result } = user;
      return result;
    }
    return 'wrong_password';
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    // Prewarm branch pools asynchronously to speed up first queries
    this.dbService.prewarmBranchPools(user).catch(() => {});
    return {
      access_token: this.jwtService.sign(payload),
      user: user,
    };
  }

  async register(userData: any) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    // Encrypt branch passwords if necessary here, but we are keeping it simple for now
    // or encrypting them in UsersService? No, UsersService just inserts.
    // Ideally we should encrypt branch passwords.
    // For now, let's just hash the user password.
    
    // Encrypt branch passwords (mock for now as we don't have encryption key setup)
    if (userData.branches) {
        userData.branches = userData.branches.map(b => ({
            ...b,
            db_password: b.db_password // Should be encrypted
        }));
    }

    const newUser = await this.usersService.create({
      ...userData,
      password: hashedPassword,
    });
    
    return this.login(newUser);
  }

  async selectBranch(userId: string, branchIndex: number) {
    await this.usersService.updateSelectedBranch(userId, branchIndex);
    // Prewarm current user's branch pools after selection
    const user = await this.usersService.findById(userId);
    if (user) {
      this.dbService.prewarmBranchPools(user).catch(() => {});
    }
    return { success: true };
  }
}
