import {
  Controller,
  Post,
  Body,
  UseGuards,
  Query,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @UseGuards(JwtAuthGuard)
  @Get('live')
  async getLiveStock(
    @Query('branchId') branchId: string,
    @Query('date') date?: string,
  ) {
    return this.stockService.getLiveStock(branchId, date);
  }

  @UseGuards(JwtAuthGuard)
  @Get('products')
  async getProducts(@Query('branchId') branchId: string) {
    return this.stockService.getProducts(branchId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('entry')
  async entryStock(@Body() data: any, @Query('branchId') branchId: string) {
    try {
      const items = data.items || [];
      return await this.stockService.entryStock(branchId, items);
    } catch (error: any) {
      console.error('Entry stock error:', error);
      const message =
        error?.message ||
        'Stok kaydedilirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
      throw new HttpException(
        message,
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('test-products')
  async testProducts() {
    // Hardcoded branchId query or logic inside service
    return this.stockService.testDemoProducts();
  }
}
