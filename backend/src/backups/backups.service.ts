import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';

type BackupTarget = {
  id: number;
  name: string;
  kind: 'local' | 'rclone' | 'icloud';
  local_path?: string | null;
  rclone_remote?: string | null;
  retention_days: number;
  is_active: boolean;
};

@Injectable()
export class BackupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsService.name);
  private activeJobs = new Set<number>();
  private scheduler?: NodeJS.Timeout;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureBackupSchema();
    await this.ensureDefaultTarget();
    this.scheduler = setInterval(() => {
      this.runDueScheduledBackups().catch((error) =>
        this.logger.warn(`Scheduled backup scan failed: ${error?.message || error}`),
      );
    }, this.schedulerIntervalMs());
  }

  onModuleDestroy() {
    if (this.scheduler) clearInterval(this.scheduler);
  }

  async getOverview(filters: any = {}) {
    await this.ensureBackupSchema();
    const [targets, configs, backups] = await Promise.all([
      this.listTargets(),
      this.listConfigs(),
      this.listBackups(filters),
    ]);

    const stats = backups.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === 'success') acc.success += 1;
        else if (item.status === 'failed') acc.failed += 1;
        else if (item.status === 'running') acc.running += 1;
        else acc.pending += 1;
        acc.total_size_bytes += Number(item.size_bytes || 0);
        return acc;
      },
      { total: 0, success: 0, failed: 0, running: 0, pending: 0, total_size_bytes: 0 },
    );

    return { targets, configs, backups, stats };
  }

  async listTargets() {
    await this.ensureBackupSchema();
    const pool = this.db.getMainPool();
    return this.db.executeQuery(
      pool,
      `SELECT * FROM backup_targets ORDER BY is_active DESC, id ASC`,
    );
  }

  async saveTarget(body: any, targetId?: number) {
    await this.ensureBackupSchema();
    const pool = this.db.getMainPool();
    const kind = body?.kind === 'icloud' ? 'icloud' : body?.kind === 'rclone' ? 'rclone' : 'local';
    const retentionDays = this.clampRetentionDays(body?.retention_days);
    const params = [
      String(body?.name || '').trim() ||
        (kind === 'icloud' ? 'iCloud Drive yedekleri' : kind === 'rclone' ? 'rclone hedefi' : 'Lokal yedek klasoru'),
      kind,
      body?.local_path ? String(body.local_path).trim() : null,
      body?.rclone_remote ? String(body.rclone_remote).trim() : null,
      retentionDays,
      body?.is_active !== false,
    ];

    if (targetId) {
      const rows = await this.db.executeQuery(
        pool,
        `UPDATE backup_targets
         SET name = $1, kind = $2, local_path = $3, rclone_remote = $4, retention_days = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [...params, targetId],
      );
      return rows[0];
    }

    const rows = await this.db.executeQuery(
      pool,
      `INSERT INTO backup_targets (name, kind, local_path, rclone_remote, retention_days, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      params,
    );
    return rows[0];
  }

  async deleteTarget(targetId: number) {
    const pool = this.db.getMainPool();
    await this.db.executeQuery(pool, `UPDATE branch_backup_configs SET target_id = NULL WHERE target_id = $1`, [targetId]);
    await this.db.executeQuery(pool, `DELETE FROM backup_targets WHERE id = $1`, [targetId]);
    return { success: true };
  }

  async listConfigs() {
    await this.ensureBackupSchema();
    const pool = this.db.getMainPool();
    return this.db.executeQuery(
      pool,
      `SELECT
         b.id AS branch_id,
         b.name AS branch_name,
         b.db_host,
         b.db_port,
         b.db_name,
         b.db_user,
         b.owner_email,
         b.branch_count,
         c.id AS config_id,
         c.target_id,
         c.is_enabled,
         c.schedule_hour,
         c.retention_days,
         c.last_run_at,
         c.next_run_at,
         t.name AS target_name,
         t.kind AS target_kind,
         (
           SELECT j.status
           FROM branch_database_backups j
           WHERE j.branch_id = b.id
           ORDER BY j.created_at DESC
           LIMIT 1
         ) AS last_status,
         (
           SELECT j.created_at
           FROM branch_database_backups j
           WHERE j.branch_id = b.id
           ORDER BY j.created_at DESC
           LIMIT 1
         ) AS last_backup_at,
         (
           SELECT j.error
           FROM branch_database_backups j
           WHERE j.branch_id = b.id
           ORDER BY j.created_at DESC
           LIMIT 1
         ) AS last_error,
         (
           SELECT j.size_bytes
           FROM branch_database_backups j
           WHERE j.branch_id = b.id
           ORDER BY j.created_at DESC
           LIMIT 1
         ) AS last_size_bytes
       FROM (
         SELECT *
         FROM (
           SELECT
             b.*,
             u.email AS owner_email,
             COUNT(*) OVER (
               PARTITION BY LOWER(TRIM(b.db_host)),
                            COALESCE(b.db_port, 5432),
                            LOWER(TRIM(b.db_name)),
                            LOWER(TRIM(b.db_user))
             ) AS branch_count,
             ROW_NUMBER() OVER (
               PARTITION BY LOWER(TRIM(b.db_host)),
                            COALESCE(b.db_port, 5432),
                            LOWER(TRIM(b.db_name)),
                            LOWER(TRIM(b.db_user))
               ORDER BY b.id ASC
             ) AS backup_source_rank
           FROM branches b
           JOIN users u ON u.id = b.user_id
         ) ranked_branches
         WHERE backup_source_rank = 1
       ) b
       LEFT JOIN branch_backup_configs c ON c.branch_id = b.id
       LEFT JOIN backup_targets t ON t.id = c.target_id
       ORDER BY b.name ASC, b.db_host ASC, b.id ASC`,
    );
  }

  async saveConfig(branchId: number, body: any) {
    await this.ensureBackupSchema();
    const pool = this.db.getMainPool();
    const scheduleHour = this.clampScheduleHour(body?.schedule_hour);
    const retentionDays = this.clampRetentionDays(body?.retention_days);
    const targetId = body?.target_id ? Number(body.target_id) : null;
    const isEnabled = body?.is_enabled === true;
    const nextRunAt = isEnabled ? this.nextRunAt(scheduleHour) : null;

    const existing = await this.db.executeQuery(
      pool,
      `UPDATE branch_backup_configs
       SET target_id = $2,
           is_enabled = $3,
           schedule_hour = $4,
           retention_days = $5,
           next_run_at = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE branch_id = $1
       RETURNING *`,
      [branchId, targetId, isEnabled, scheduleHour, retentionDays, nextRunAt],
    );
    if (existing[0]) return existing[0];

    const rows = await this.db.executeQuery(
      pool,
      `INSERT INTO branch_backup_configs (branch_id, target_id, is_enabled, schedule_hour, retention_days, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [branchId, targetId, isEnabled, scheduleHour, retentionDays, nextRunAt],
    );
    return rows[0];
  }

  async listBackups(filters: any = {}) {
    await this.ensureBackupSchema();
    const pool = this.db.getMainPool();
    const limit = Math.min(500, Math.max(20, parseInt(String(filters.limit || 100), 10) || 100));
    const status = String(filters.status || '').trim();
    const branchId = filters.branch_id ? Number(filters.branch_id) : null;
    const where: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      where.push(`j.status = $${params.length}`);
    }
    if (branchId) {
      params.push(branchId);
      where.push(`j.branch_id = $${params.length}`);
    }
    params.push(limit);

    return this.db.executeQuery(
      pool,
      `SELECT j.*, t.name AS target_name, t.kind AS target_kind
       FROM branch_database_backups j
       LEFT JOIN backup_targets t ON t.id = j.target_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY j.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
  }

  async createManualBackup(branchId: number, userEmail: string, targetId?: number | null) {
    return this.createBackupJob(branchId, 'manual', userEmail, targetId || null);
  }

  async runDueScheduledBackups() {
    const pool = this.db.getMainPool();
    const rows = await this.db.executeQuery(
      pool,
      `SELECT c.branch_id, c.target_id
       FROM branch_backup_configs c
       WHERE c.is_enabled = TRUE
         AND (c.next_run_at IS NULL OR c.next_run_at <= CURRENT_TIMESTAMP)
       ORDER BY c.next_run_at NULLS FIRST, c.branch_id ASC
       LIMIT 3`,
    );

    for (const row of rows) {
      await this.createBackupJob(Number(row.branch_id), 'scheduled', 'scheduler', row.target_id ? Number(row.target_id) : null);
    }
  }

  private async createBackupJob(
    branchId: number,
    triggerType: 'manual' | 'scheduled',
    createdBy: string,
    preferredTargetId: number | null,
  ) {
    await this.ensureBackupSchema();
    const pool = this.db.getMainPool();
    const branch = await this.getBranch(branchId);
    if (!branch) throw new Error('Sube bulunamadi.');

    const configRows = await this.db.executeQuery(
      pool,
      `SELECT * FROM branch_backup_configs WHERE branch_id = $1 LIMIT 1`,
      [branchId],
    );
    const branchConfig = configRows[0] || null;
    const target =
      (preferredTargetId ? await this.getTarget(preferredTargetId) : null) ||
      (branchConfig?.target_id ? await this.getTarget(Number(branchConfig.target_id)) : null) ||
      (await this.ensureDefaultTarget());

    const jobRows = await this.db.executeQuery(
      pool,
      `INSERT INTO branch_database_backups
        (branch_id, target_id, branch_name, owner_email, database_name, status, trigger_type, created_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
       RETURNING *`,
      [branchId, target?.id || null, branch.name, branch.owner_email, branch.db_name, triggerType, createdBy],
    );
    const job = jobRows[0];
    setImmediate(() => {
      this.runBackupJob(Number(job.id)).catch((error) =>
        this.logger.error(`Backup job ${job.id} failed`, error?.stack || error),
      );
    });
    return job;
  }

  private async runBackupJob(jobId: number) {
    if (this.activeJobs.has(jobId)) return;
    this.activeJobs.add(jobId);
    const pool = this.db.getMainPool();
    const startedAt = new Date();

    try {
      const rows = await this.db.executeQuery(
        pool,
        `SELECT j.*, b.db_host, b.db_port, b.db_name, b.db_user, b.db_password
         FROM branch_database_backups j
         JOIN branches b ON b.id = j.branch_id
         WHERE j.id = $1
         LIMIT 1`,
        [jobId],
      );
      const job = rows[0];
      if (!job) return;

      const target = (await this.getTarget(Number(job.target_id))) || (await this.ensureDefaultTarget());
      if (!target) throw new Error('Yedekleme hedefi bulunamadi.');
      await this.db.executeQuery(
        pool,
        `UPDATE branch_database_backups SET status = 'running', started_at = $1, error = NULL WHERE id = $2`,
        [startedAt, jobId],
      );

      const dumpPath = await this.createPgDump(job);
      const stat = await fs.promises.stat(dumpPath);
      if (!stat.size) throw new Error('pg_dump bos dosya olusturdu.');
      const checksum = await this.sha256(dumpPath);
      const fileName = path.basename(dumpPath);
      const storagePath = await this.storeDump(dumpPath, target, job);
      const finishedAt = new Date();

      await this.db.executeQuery(
        pool,
        `UPDATE branch_database_backups
         SET status = 'success',
             file_name = $1,
             storage_path = $2,
             size_bytes = $3,
             checksum = $4,
             finished_at = $5,
             duration_ms = $6
         WHERE id = $7`,
        [
          fileName,
          storagePath,
          stat.size,
          checksum,
          finishedAt,
          Math.max(0, finishedAt.getTime() - startedAt.getTime()),
          jobId,
        ],
      );

      await this.markConfigRun(Number(job.branch_id), finishedAt);
      await this.cleanupOldBackups(target);
    } catch (error: any) {
      const finishedAt = new Date();
      await this.db.executeQuery(
        pool,
        `UPDATE branch_database_backups
         SET status = 'failed', finished_at = $1, duration_ms = $2, error = $3
         WHERE id = $4`,
        [
          finishedAt,
          Math.max(0, finishedAt.getTime() - startedAt.getTime()),
          String(error?.message || error || 'Yedek alinamadi').slice(0, 2000),
          jobId,
        ],
      );
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private async createPgDump(job: any) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const fileName = `${this.safeName(job.branch_name)}-${this.safeName(job.db_name)}-${stamp}.dump`;
    const tempDir = path.join(this.localRoot(), '_tmp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    const dumpPath = path.join(tempDir, fileName);

    await this.spawnCommand(
      this.config.get<string>('PG_DUMP_BIN') || 'pg_dump',
      [
        '-h',
        String(job.db_host),
        '-p',
        String(job.db_port || 5432),
        '-U',
        String(job.db_user),
        '-d',
        String(job.db_name),
        '-Fc',
        '-Z',
        String(this.config.get<string>('BACKUP_PG_DUMP_COMPRESSION') || '6'),
        '-f',
        dumpPath,
      ],
      {
        env: { ...process.env, PGPASSWORD: String(job.db_password || '') },
        timeoutMs: Number(this.config.get<string>('BACKUP_JOB_TIMEOUT_MS') || 30 * 60 * 1000),
      },
    );

    return dumpPath;
  }

  private async storeDump(tempPath: string, target: BackupTarget, job: any) {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const relativeDir = path.join(String(job.branch_id || 'unknown'), y, m, d);
    const fileName = path.basename(tempPath);

    if (target.kind === 'rclone' || target.kind === 'icloud') {
      if (!target.rclone_remote) throw new Error('rclone hedef yolu bos.');
      const remoteDir = `${target.rclone_remote.replace(/\/+$/, '')}/${relativeDir.split(path.sep).join('/')}`;
      await this.spawnCommand(this.config.get<string>('RCLONE_BIN') || 'rclone', ['mkdir', remoteDir], {
        timeoutMs: 120000,
      });
      await this.spawnCommand(
        this.config.get<string>('RCLONE_BIN') || 'rclone',
        ['copyto', tempPath, `${remoteDir}/${fileName}`],
        { timeoutMs: Number(this.config.get<string>('BACKUP_UPLOAD_TIMEOUT_MS') || 30 * 60 * 1000) },
      );
      await fs.promises.unlink(tempPath);
      return `${remoteDir}/${fileName}`;
    }

    const root = this.writableLocalRoot(target.local_path);
    const finalDir = path.join(root, relativeDir);
    await fs.promises.mkdir(finalDir, { recursive: true });
    const finalPath = path.join(finalDir, fileName);
    await fs.promises.rename(tempPath, finalPath);
    return finalPath;
  }

  private async cleanupOldBackups(target: BackupTarget) {
    if (!target || target.kind !== 'local') return;
    const root = this.writableLocalRoot(target.local_path);
    const cutoff = Date.now() - this.clampRetentionDays(target.retention_days) * 24 * 60 * 60 * 1000;
    const walk = async (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(entryPath);
          await fs.promises.rmdir(entryPath).catch(() => undefined);
          continue;
        }
        if (!entry.name.endsWith('.dump')) continue;
        const stat = await fs.promises.stat(entryPath);
        if (stat.mtime.getTime() < cutoff) {
          await fs.promises.unlink(entryPath);
        }
      }
    };
    await walk(root);
  }

  private async markConfigRun(branchId: number, finishedAt: Date) {
    const pool = this.db.getMainPool();
    const rows = await this.db.executeQuery(
      pool,
      `SELECT schedule_hour FROM branch_backup_configs WHERE branch_id = $1 LIMIT 1`,
      [branchId],
    );
    const scheduleHour = this.clampScheduleHour(rows[0]?.schedule_hour);
    await this.db.executeQuery(
      pool,
      `UPDATE branch_backup_configs
       SET last_run_at = $1, next_run_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE branch_id = $3`,
      [finishedAt, this.nextRunAt(scheduleHour, finishedAt), branchId],
    );
  }

  private async getBranch(branchId: number) {
    const pool = this.db.getMainPool();
    const rows = await this.db.executeQuery(
      pool,
      `SELECT b.*, u.email AS owner_email
       FROM branches b
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1
       LIMIT 1`,
      [branchId],
    );
    return rows[0] || null;
  }

  private async getTarget(targetId: number): Promise<BackupTarget | null> {
    if (!targetId) return null;
    const pool = this.db.getMainPool();
    const rows = await this.db.executeQuery(pool, `SELECT * FROM backup_targets WHERE id = $1 LIMIT 1`, [targetId]);
    return rows[0] || null;
  }

  private async ensureDefaultTarget(): Promise<BackupTarget | null> {
    await this.ensureBackupSchema();
    const pool = this.db.getMainPool();
    const existing = await this.db.executeQuery(
      pool,
      `SELECT * FROM backup_targets WHERE is_active = TRUE ORDER BY id ASC LIMIT 1`,
    );
    if (existing[0]) return existing[0];
    const created = await this.db.executeQuery(
      pool,
      `INSERT INTO backup_targets (name, kind, local_path, retention_days, is_active)
       VALUES ('Sunucu lokal yedek klasoru', 'local', $1, 3, TRUE)
       RETURNING *`,
      [this.localRoot()],
    );
    return created[0] || null;
  }

  private async ensureBackupSchema() {
    const pool = this.db.getMainPool();
    await this.db.executeQuery(
      pool,
      `CREATE TABLE IF NOT EXISTS backup_targets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        kind VARCHAR(30) NOT NULL DEFAULT 'local',
        local_path TEXT,
        rclone_remote TEXT,
        retention_days INTEGER NOT NULL DEFAULT 3,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await this.db.executeQuery(
      pool,
      `CREATE TABLE IF NOT EXISTS branch_backup_configs (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
        target_id INTEGER REFERENCES backup_targets(id) ON DELETE SET NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        schedule_hour INTEGER NOT NULL DEFAULT 2,
        retention_days INTEGER NOT NULL DEFAULT 3,
        last_run_at TIMESTAMP,
        next_run_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await this.db.executeQuery(
      pool,
      `CREATE TABLE IF NOT EXISTS branch_database_backups (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        target_id INTEGER REFERENCES backup_targets(id) ON DELETE SET NULL,
        branch_name TEXT,
        owner_email TEXT,
        database_name TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        trigger_type VARCHAR(30) NOT NULL DEFAULT 'manual',
        file_name TEXT,
        storage_path TEXT,
        size_bytes BIGINT,
        checksum TEXT,
        started_at TIMESTAMP,
        finished_at TIMESTAMP,
        duration_ms INTEGER,
        error TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await this.db.executeQuery(
      pool,
      `UPDATE backup_targets
       SET local_path = $1, updated_at = CURRENT_TIMESTAMP
       WHERE kind = 'local'
         AND local_path LIKE '/var/task%'`,
      [this.localRoot()],
    );
  }

  private spawnCommand(
    command: string,
    args: string[],
    options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
  ) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(command, args, {
        env: options.env || process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timeout = options.timeoutMs
        ? setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`${command} zaman asimina ugradi.`));
          }, options.timeoutMs)
        : null;

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        if (timeout) clearTimeout(timeout);
        const code = (error as any)?.code;
        if (code === 'ENOENT') {
          if (command.includes('pg_dump')) {
            reject(new Error('Sunucuda pg_dump bulunamadi. PostgreSQL client tools kurun veya PG_DUMP_BIN ile pg_dump yolunu tanimlayin.'));
            return;
          }
          if (command.includes('rclone')) {
            reject(new Error('Sunucuda rclone bulunamadi. iCloud/rclone hedefi icin rclone kurun veya RCLONE_BIN ile yolunu tanimlayin.'));
            return;
          }
        }
        reject(error);
      });
      child.on('close', (code) => {
        if (timeout) clearTimeout(timeout);
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(stderr || `${command} ${code} kodu ile kapandi.`));
      });
    });
  }

  private sha256(filePath: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  private localRoot() {
    const configured = this.config.get<string>('BACKUP_LOCAL_ROOT');
    if (configured) return configured;
    if (process.env.VERCEL || process.cwd().startsWith('/var/task')) {
      return path.join(os.tmpdir(), 'backups', 'database');
    }
    return path.join(process.cwd(), 'backups', 'database');
  }

  private writableLocalRoot(value?: string | null) {
    const root = value || this.localRoot();
    if (root.startsWith('/var/task')) {
      return path.join(os.tmpdir(), 'backups', 'database');
    }
    return root;
  }

  private schedulerIntervalMs() {
    return Math.max(60000, Number(this.config.get<string>('BACKUP_SCHEDULER_INTERVAL_MS') || 5 * 60 * 1000));
  }

  private clampRetentionDays(value: any) {
    const parsed = parseInt(String(value ?? 3), 10);
    return Math.min(30, Math.max(1, Number.isFinite(parsed) ? parsed : 3));
  }

  private clampScheduleHour(value: any) {
    const parsed = parseInt(String(value ?? 2), 10);
    return Math.min(23, Math.max(0, Number.isFinite(parsed) ? parsed : 2));
  }

  private nextRunAt(hour: number, from = new Date()) {
    const next = new Date(from);
    next.setHours(hour, 0, 0, 0);
    if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
    return next;
  }

  private safeName(value: any) {
    return (
      String(value || 'backup')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'backup'
    );
  }
}
