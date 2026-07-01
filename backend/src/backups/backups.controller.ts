import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BackupsService } from './backups.service';

@Controller('api/admin/backups')
@UseGuards(JwtAuthGuard)
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  private assertAdmin(req: any) {
    if (!req.user?.is_admin) {
      throw new ForbiddenException();
    }
  }

  @Get()
  async overview(@Request() req, @Query() query: any) {
    this.assertAdmin(req);
    return this.backupsService.getOverview(query);
  }

  @Get('jobs')
  async jobs(@Request() req, @Query() query: any) {
    this.assertAdmin(req);
    return this.backupsService.listBackups(query);
  }

  @Post('run')
  async run(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    const branchId = Number(body?.branch_id);
    if (!Number.isFinite(branchId)) {
      throw new BadRequestException('Gecersiz sube.');
    }
    return this.backupsService.createManualBackup(
      branchId,
      req.user?.email || 'admin',
      body?.target_id ? Number(body.target_id) : null,
    );
  }

  @Post('targets')
  async createTarget(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.backupsService.saveTarget(body);
  }

  @Put('targets/:id')
  async updateTarget(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.backupsService.saveTarget(body, Number(id));
  }

  @Delete('targets/:id')
  async deleteTarget(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.backupsService.deleteTarget(Number(id));
  }

  @Put('configs/:branchId')
  async saveConfig(
    @Request() req,
    @Param('branchId') branchId: string,
    @Body() body: any,
  ) {
    this.assertAdmin(req);
    return this.backupsService.saveConfig(Number(branchId), body);
  }
}
