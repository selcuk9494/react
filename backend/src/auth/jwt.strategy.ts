import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService, private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production'),
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findOne(payload.email);
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
    const adminEmails = (this.configService.get<string>('ADMIN_EMAILS') || 'selcuk.yilmaz@microvise.net')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (adminEmails.includes(payload.email) && !user.is_admin) {
      const updated = await this.usersService.update(user.id, { is_admin: true });
      return updated || { ...user, is_admin: true };
    }
    return user;
  }
}
