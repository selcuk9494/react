import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    console.log(`Validating user: ${email}`);
    const user = await this.usersService.findOne(email);
    if (!user) {
      console.log('User not found in DB');
      return 'not_found';
    }
    console.log('User found, checking password...');
    if (await bcrypt.compare(pass, user.password)) {
      if (user.expiry_date) {
        const now = new Date();
        const exp = new Date(user.expiry_date);
        if (exp.getTime() < now.getTime()) {
          console.log('User expired');
          return 'expired';
        }
      }
      console.log('Password correct');
      const result: any = { ...user };
      delete result.password;
      return result;
    }
    console.log('Wrong password');
    return 'wrong_password';
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: user,
    };
  }

  async loginDemo() {
    const demoEmail = 'demo@micrapor.com';
    const demoPassword = 'demo';

    // Check if demo user exists
    let user = await this.usersService.findOne(demoEmail);

    if (!user) {
      // Create demo user
      const hashedPassword = await bcrypt.hash(demoPassword, 10);
      user = await this.usersService.create({
        email: demoEmail,
        password: hashedPassword,
        username: 'Demo Kullanıcı',
        branches: [
          {
            name: 'Demo Şube (FastRest)',
            db_host: 'dpg-d63sq9pr0fns73brtqbg-a.frankfurt-postgres.render.com',
            db_port: 5432,
            db_user: 'frfood_user',
            db_password: 'OPie7Pm4dGIG2N8KAnvFtOYu8QyiSPSt',
            db_name: 'react',
          },
        ],
      });
    }

    // Generate token
    const payload = { email: user.email, sub: user.id, role: 'demo' };

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
      userData.branches = userData.branches.map((b) => ({
        ...b,
        db_password: b.db_password, // Should be encrypted
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
    return { success: true };
  }

  async checkConnection() {
    return this.usersService.checkConnection();
  }
}
