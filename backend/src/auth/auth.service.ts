import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    console.log(`Validating user: ${email}`);
    const user = await this.usersService.findOne(email);
    if (!user) {
      console.log('User not found in DB');
      return 'not_found';
    }
    console.log('User found, checking password...');
    let passwordMatches = user.password === pass;
    if (!passwordMatches && user.password) {
      try {
        passwordMatches = await bcrypt.compare(pass, user.password);
      } catch {
        passwordMatches = false;
      }
    }
    if (passwordMatches) {
      if (user.password === pass) {
        await this.usersService.upgradePlainPassword(user.id, pass);
      }
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

  async loginWithApple(
    identityToken: string,
    profile?: { email?: string; givenName?: string; familyName?: string },
  ) {
    const claims = await this.verifyAppleIdentityToken(identityToken);
    const appleId = String(claims.sub || '').trim();
    if (!appleId) {
      throw new UnauthorizedException('Apple kimliği doğrulanamadı');
    }

    const tokenEmail = String(claims.email || profile?.email || '')
      .trim()
      .toLowerCase();

    let user = await this.usersService.findByAppleId(appleId);
    if (!user && tokenEmail) {
      user = await this.usersService.findOne(tokenEmail);
      if (user) {
        await this.usersService.linkAppleId(user.id, appleId);
        user = await this.usersService.findOne(tokenEmail);
      }
    }

    if (!user) {
      if (!tokenEmail) {
        throw new UnauthorizedException(
          'Bu Apple hesabı henüz bağlı değil. İlk girişte e-posta paylaşın veya mevcut hesabınızla giriş yapın.',
        );
      }
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const displayName = [profile?.givenName, profile?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      user = await this.usersService.create({
        email: tokenEmail,
        password: randomPassword,
        username: displayName || undefined,
        apple_id: appleId,
      });
      user = await this.usersService.findOne(tokenEmail);
    }

    if (user?.expiry_date) {
      const exp = new Date(user.expiry_date);
      if (exp.getTime() < Date.now()) {
        throw new UnauthorizedException(
          'Kullanım süreniz dolmuş. Lütfen yöneticinizle iletişime geçin.',
        );
      }
    }

    const result: any = { ...user };
    delete result.password;
    return this.login(result);
  }

  private appleAudiences(): string[] {
    const fromList = (this.configService.get<string>('APPLE_CLIENT_IDS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const bundle =
      this.configService.get<string>('APPLE_BUNDLE_ID') || 'com.micrapor.mobile';
    const service = this.configService.get<string>('APPLE_SERVICE_ID') || '';
    return [...new Set([...fromList, bundle, service].filter(Boolean))];
  }

  private async verifyAppleIdentityToken(identityToken: string) {
    const token = String(identityToken || '').trim();
    if (!token) {
      throw new UnauthorizedException('Apple kimlik jetonu yok');
    }
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('invalid token');
      }
      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      );
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      if (payload?.iss !== APPLE_ISSUER) {
        throw new Error('issuer');
      }
      const audiences = this.appleAudiences();
      const aud = payload?.aud;
      const audOk = Array.isArray(aud)
        ? aud.some((item) => audiences.includes(String(item)))
        : audiences.includes(String(aud || ''));
      if (!audOk) {
        throw new Error('audience');
      }
      if (payload?.exp && Number(payload.exp) * 1000 < Date.now()) {
        throw new Error('expired');
      }
      const jwksRes = await fetch(APPLE_JWKS_URL);
      const jwks = await jwksRes.json();
      const jwk = (jwks?.keys || []).find((key: any) => key.kid === header.kid);
      if (!jwk) {
        throw new Error('key');
      }
      const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${parts[0]}.${parts[1]}`);
      const signature = Buffer.from(parts[2], 'base64url');
      if (!verifier.verify(publicKey, signature)) {
        throw new Error('signature');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Apple girişi doğrulanamadı');
    }
  }
}
