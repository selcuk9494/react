import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { ReportsModule } from '../reports/reports.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [ReportsModule, DatabaseModule],
  controllers: [CronController],
})
export class CronModule {}
