import { Controller, Post, Body, UseGuards, Request, Get, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth') // Prefix to match original
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() req) {
    const result = await this.authService.validateUser(req.email, req.password);
    if (result === 'not_found') {
        throw new UnauthorizedException('Kullanıcı bulunamadı');
    }
    if (result === 'wrong_password') {
        throw new UnauthorizedException('Girdiğiniz şifre hatalı');
    }
    if (result === 'expired') {
        throw new UnauthorizedException('Kullanım süreniz dolmuş. Lütfen yöneticinizle iletişime geçin.');
    }
    return this.authService.login(result);
  }

  @Post('register')
  async register(@Body() userData) {
    return this.authService.register(userData);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-branch')
  async selectBranch(@Request() req, @Body() body) {
    return this.authService.selectBranch(req.user.id, body.index);
  }
}
