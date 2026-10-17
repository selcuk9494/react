import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

const USER_CACHE_TTL_MS = 60_000;
const userCache = new Map<string, { user: any; expires: number }>();

/** Sube degisimi / profil guncellemesi sonrasi cache'i dusur. */
export function invalidateUserCache(email?: string) {
  if (!email) {
    userCache.clear();
    return;
  }
  userCache.delete(String(email).toLowerCase());
  userCache.delete(String(email));
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-change-in-production',
    });
  }

  async validate(payload: any) {
    const email = String(payload?.email || '');
    const cacheKey = email.toLowerCase();
    const cached = cacheKey ? userCache.get(cacheKey) : null;
    if (cached && cached.expires > Date.now()) {
      return cached.user;
    }

    const user = await this.usersService.findOne(email);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.expiry_date) {
      const now = new Date();
      const exp = new Date(user.expiry_date);
      if (exp.getTime() < now.getTime()) {
        throw new UnauthorizedException();
      }
    }
    const adminEmails = (
      this.configService.get<string>('ADMIN_EMAILS') ||
      'selcuk.yilmaz@microvise.net'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let resolved = user;
    if (adminEmails.includes(email) && !user.is_admin) {
      const updated = await this.usersService.update(user.id, {
        is_admin: true,
      });
      resolved = updated || { ...user, is_admin: true };
    }
    if (cacheKey) {
      userCache.set(cacheKey, {
        user: resolved,
        expires: Date.now() + USER_CACHE_TTL_MS,
      });
    }
    return resolved;
  }
}
