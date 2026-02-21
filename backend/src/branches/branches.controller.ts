import { Controller, Get, Post, Body, UseGuards, Request, Put, Delete, Param } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async findAll(@Request() req) {
    // Assuming the user object in request has userId property from JWT strategy
    return this.branchesService.findAll(req.user.id);
  }

  @Post()
  async create(@Request() req, @Body() body) {
    return this.branchesService.create(req.user.id, body);
  }

  @Put(':id')
  async update(@Request() req, @Param('id') id: string, @Body() body) {
    return this.branchesService.update(req.user.id, +id, body);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.branchesService.remove(req.user.id, +id);
  }
}
