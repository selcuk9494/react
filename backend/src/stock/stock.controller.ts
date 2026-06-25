import {
  Controller,
  Post,
  Body,
  UseGuards,
  Query,
  Get,
  Put,
  Request,
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
  @Post('product')
  async createProduct(
    @Request() req,
    @Query('branchId') branchId: string,
    @Body() body: any,
  ) {
    try {
      return await this.stockService.createProduct(req.user, branchId, body);
    } catch (error: any) {
      console.error('Create product error:', error);
      const message =
        error?.message || 'Ürün eklenirken beklenmeyen bir hata oluştu.';
      throw new HttpException(
        { message, code: error?.code || null },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('product-prices')
  async getProductPrices(@Request() req, @Query('branchId') branchId: string) {
    try {
      return await this.stockService.getProductPrices(req.user, branchId);
    } catch (error: any) {
      console.error('Get product prices error:', error);
      const message =
        error?.message || 'Fiyat listesi alınırken beklenmeyen bir hata oluştu.';
      throw new HttpException(
        { message, code: error?.code || null },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put('product-prices')
  async updateProductPrices(
    @Request() req,
    @Query('branchId') branchId: string,
    @Body() body: any,
  ) {
    try {
      return await this.stockService.updateProductPricesBulk(
        req.user,
        branchId,
        body,
      );
    } catch (error: any) {
      console.error('Bulk update prices error:', error);
      const message =
        error?.message || 'Fiyatlar güncellenirken beklenmeyen bir hata oluştu.';
      throw new HttpException(
        { message, code: error?.code || null },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put('product-price')
  async updateProductPrice(
    @Request() req,
    @Query('branchId') branchId: string,
    @Body() body: any,
  ) {
    try {
      return await this.stockService.updateProductPrice(req.user, branchId, body);
    } catch (error: any) {
      console.error('Update price error:', error);
      const message =
        error?.message || 'Fiyat güncellenirken beklenmeyen bir hata oluştu.';
      throw new HttpException(
        message,
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
