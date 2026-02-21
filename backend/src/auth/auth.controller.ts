import { Controller, Post, Body, UseGuards, Request, Get, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth') // Prefix to match original
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() req) {
    try {
      console.log('Login attempt:', req.email); // Log email
      
      // Allow demo login with both 'demo' and 'demo@micrapor.com'
      if ((req.email === 'demo' || req.email === 'demo@micrapor.com') && req.password === 'demo') {
          console.log('Demo login triggered');
          return await this.authService.loginDemo();
      }
      
      const result = await this.authService.validateUser(req.email, req.password);
      
      if (!result) { // validateUser might return null
          console.log('User validation failed (null result)');
          throw new UnauthorizedException('Kullanıcı doğrulanamadı');
      }

      if (result === 'not_found') {
          throw new UnauthorizedException('Kullanıcı bulunamadı');
      }
      if (result === 'wrong_password') {
          throw new UnauthorizedException('Girdiğiniz şifre hatalı');
      }
      if (result === 'expired') {
          throw new UnauthorizedException('Kullanım süreniz dolmuş. Lütfen yöneticinizle iletişime geçin.');
      }
      
      console.log('Login successful for:', req.email);
      return await this.authService.login(result);
    } catch (error) {
      console.error('Login Error Details:', error);
      // Return error details to frontend for debugging
      throw new HttpException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Login Error',
        message: error.message || 'Unknown error',
        stack: error.stack // Always show stack for debugging
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('register')
  async register(@Body() userData) {
    return this.authService.register(userData);
  }

  @Get('check-login')
  async checkLogin() {
    return this.authService.checkConnection();
  }

  @Get('demo-fix')
  async demoFix() {
    try {
        const email = 'demo@micrapor.com';
        // 1. Check if user exists
        const user = await this.authService.validateUser(email, 'demo');
        
        if (user && user !== 'not_found' && user !== 'wrong_password') {
            return { status: 'ok', message: 'User exists and password correct', user };
        }
        
        // 2. Try loginDemo
        const loginRes = await this.authService.loginDemo();
        return { status: 'ok', message: 'loginDemo worked', result: loginRes };

    } catch (error) {
        return { 
            status: 'error', 
            message: error.message, 
            stack: error.stack 
        };
    }
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
