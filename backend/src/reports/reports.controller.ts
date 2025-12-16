import { Controller, Get, Query, Request, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { interval, Observable, from, map, switchMap } from 'rxjs';

@Controller('api')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboard(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.getDashboard(req.user, period, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/orders')
  async getOrders(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('status') status: 'open' | 'closed',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('type') type?: 'adisyon' | 'paket',
  ) {
    return this.reportsService.getOrders(req.user, period, status, startDate, endDate, type);
  }

  // Compatibility endpoints to match legacy clients
  @UseGuards(JwtAuthGuard)
  @Get('reports/open-orders')
  async getOpenOrders(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('type') type?: 'adisyon' | 'paket',
  ) {
    return this.reportsService.getOrders(req.user, period, 'open', startDate, endDate, type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/closed-orders')
  async getClosedOrders(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('type') type?: 'adisyon' | 'paket',
  ) {
    return this.reportsService.getOrders(req.user, period, 'closed', startDate, endDate, type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/order-details')
  async getOrderDetails(
    @Request() req,
    @Query('adsno') adsno: string,
    @Query('status') status: 'open' | 'closed',
    @Query('date') date?: string,
  ) {
    return this.reportsService.getOrderDetails(req.user, adsno, status, date);
  }

  // Path-param variant to match legacy clients
  @UseGuards(JwtAuthGuard)
  @Get('reports/order-detail/:id')
  async getOrderDetailLegacy(
    @Request() req,
    @Query('order_type') orderType: 'open' | 'closed' = 'closed',
    @Query('date') date?: string,
  ) {
    // Note: Nest will inject params via Request object for path param; extract safely
    const id = req.params?.id;
    return this.reportsService.getOrderDetails(req.user, id, orderType, date);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/courier-tracking')
  async getCourierTracking(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.getCourierTracking(req.user, period, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/sales-chart')
  async getSalesChart(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.getSalesChart(req.user, period, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/payment-types')
  async getPaymentTypes(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.getPaymentTypes(req.user, period, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/cancelled-items')
  async getCancelledItems(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.getCancelledItems(req.user, period, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/performance')
  async getPerformance(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.getPerformance(req.user, period, startDate, endDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/product-sales')
  async getProductSales(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('group_id') groupId?: number,
  ) {
    return this.reportsService.getProductSales(req.user, period, startDate, endDate, groupId);
  }

  @UseGuards(JwtAuthGuard)
  @Sse('stream/dashboard')
  sseDashboard(
    @Request() req,
    @Query('period') period: string = 'today',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Observable<MessageEvent> {
    return interval(5000).pipe(
      switchMap(() => from(this.reportsService.getDashboard(req.user, period, startDate, endDate))),
      map((data) => ({
        data: data,
        type: 'dashboard',
      })),
    );
  }
}
