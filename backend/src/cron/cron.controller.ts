import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { DatabaseService } from '../database/database.service';

@Controller('api/cron')
export class CronController {
  constructor(
    private readonly reports: ReportsService,
    private readonly db: DatabaseService,
  ) {}

  private assertCron(auth?: string) {
    const secret = process.env.CRON_SECRET || process.env.JWT_SECRET || '';
    if (!secret) return;
    const token = String(auth || '').replace(/^Bearer\s+/i, '').trim();
    if (token !== secret) {
      throw new UnauthorizedException('cron auth');
    }
  }

  /** IP'li subelerin dashboard snapshot'ini isitir (Vercel Cron). */
  @Get('warm-dashboards')
  async warmDashboards(@Headers('authorization') auth?: string) {
    this.assertCron(auth);
    const pool = this.db.getMainPool();
    const rows = await this.db.executeQuery(
      pool,
      `
      SELECT b.id
      FROM branches b
      WHERE COALESCE(b.connection_mode, 'direct') = 'direct'
        AND b.db_host NOT LIKE 'agent:%'
      ORDER BY b.id DESC
      LIMIT 20
      `,
      [],
    );
    const results: any[] = [];
    for (const row of rows) {
      const id = Number(row.id);
      try {
        const started = Date.now();
        await this.reports.refreshDashboardSnapshotForBranch(id, 'today');
        results.push({ id, ok: true, ms: Date.now() - started });
      } catch (e: any) {
        results.push({ id, ok: false, error: e?.message || String(e) });
      }
    }
    return { warmed: results.length, results };
  }
}
