import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { BranchesService } from '../branches/branches.service';

@Controller('api/admin')
@UseGuards(JwtAuthGuard)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly branchesService: BranchesService,
  ) {}

  private assertAdmin(req: any) {
    if (!req.user?.is_admin) {
      throw new ForbiddenException();
    }
  }

  @Get('users')
  async listUsers(@Request() req) {
    this.assertAdmin(req);
    const users = await this.usersService.findAll();
    const withBranches = await Promise.all(users.map(async (u: any) => {
      const branches = await this.branchesService.findAll(u.id);
      return { ...u, branches };
    }));
    return withBranches;
  }

  @Post('users')
  async createUser(@Request() req, @Body() body: any) {
    this.assertAdmin(req);
    return this.usersService.create(body);
  }

  @Put('users/:id')
  async updateUser(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.usersService.update(id, body);
  }

  @Delete('users/:id')
  async deleteUser(@Request() req, @Param('id') id: string) {
    this.assertAdmin(req);
    await this.usersService.remove(id);
    return { success: true };
  }

  @Post('users/:id/password')
  async changePassword(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    await this.usersService.updatePassword(id, body?.password);
    return { success: true };
  }

  @Post('users/:id/extend')
  async extendUser(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    const updated = await this.usersService.extendExpiry(id, Number(body?.days) || 30);
    return updated;
  }

  @Post('users/:id/branches')
  async addBranch(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.branchesService.create(id, body);
  }

  @Get('branches')
  async listAllBranches(@Request() req) {
    this.assertAdmin(req);
    return this.branchesService.findAllGlobal();
  }

  @Post('users/:id/branches/assign')
  async assignExistingBranch(@Request() req, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    const branchId = Number(body?.branch_id);
    return this.branchesService.copyToUser(id, branchId);
  }

  @Put('users/:id/branches/:branchId')
  async updateBranch(@Request() req, @Param('id') id: string, @Param('branchId') branchId: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.branchesService.update(id, Number(branchId), body);
  }

  @Delete('users/:id/branches/:branchId')
  async deleteBranch(@Request() req, @Param('id') id: string, @Param('branchId') branchId: string) {
    this.assertAdmin(req);
    return this.branchesService.remove(id, Number(branchId));
  }
}
