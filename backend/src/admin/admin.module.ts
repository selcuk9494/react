import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BranchesModule } from '../branches/branches.module';
import { AdminUsersController } from './admin.users.controller';

@Module({
  imports: [UsersModule, BranchesModule],
  controllers: [AdminUsersController],
})
export class AdminModule {}
