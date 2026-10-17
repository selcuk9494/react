import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('agent/enroll')
  enroll(@Body() body: any) {
    return this.agentService.enroll(body?.machineName);
  }

  @Post('agent/poll')
  poll(@Body() body: any) {
    return this.agentService.poll(body?.agentId, body?.secret);
  }

  @Post('agent/job-result')
  completeJob(@Body() body: any) {
    return this.agentService.completeJob(
      body?.agentId,
      body?.secret,
      body?.jobId,
      body?.rows,
      body?.error,
      body?.batch,
    );
  }

  @Post('agent/dashboard-snapshot')
  saveSnapshot(@Body() body: any) {
    return this.agentService.saveDashboardSnapshotFromAgent(
      body?.agentId,
      body?.secret,
      body?.period || 'today',
      body?.payload,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('branches/pair')
  pair(@Request() req, @Body() body: any) {
    return this.agentService.pairToUser(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('branches/repair')
  repair(@Request() req, @Body() body: any) {
    return this.agentService.repairBranch(req.user.id, body);
  }
}
