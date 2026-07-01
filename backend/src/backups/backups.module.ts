import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [BackupsController],
  providers: [BackupsService],
})
export class BackupsModule {}
