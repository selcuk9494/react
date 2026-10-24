import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../cache/cache.service';

/** Yazma belirsizliği — otomatik reclaim/retry yok (manuel doğrulama). */
const AMBIGUOUS_WRITE_ERROR = 'ambiguous_write_needs_review';

@Injectable()
export class AgentService {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
  ) {}

  private hashSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private safeEqualHex(a: string, b: string) {
    const aa = Buffer.from(String(a || ''), 'utf8');
    const bb = Buffer.from(String(b || ''), 'utf8');
    if (aa.length !== bb.length) return false;
    try {
      return timingSafeEqual(aa, bb);
    } catch {
      return false;
    }
  }

  private isMutatingSql(sql: string) {
    let s = String(sql || '');
    s = s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').trim();
    if (!s) return false;
    if (s === '__BATCH__') return true;
    return /^(WITH\b[\s\S]*?\bAS\b[\s\S]*?)?(INSERT|UPDATE|DELETE|UPSERT|MERGE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|DO|REFRESH|VACUUM|CLUSTER|REINDEX|COPY)\b/i.test(
      s,
    );
  }

  private isMutatingJob(job: { sql?: string; params?: any }) {
    if (!job) return false;
    if (job.sql === '__BATCH__') {
      const parts = Array.isArray(job.params) ? job.params : [];
      if (!parts.length) return true;
      return parts.some((p: any) => this.isMutatingSql(p?.sql));
    }
    return this.isMutatingSql(String(job.sql || ''));
  }

  private makePairCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let raw = '';
    const bytes = randomBytes(6);
    for (const byte of bytes) raw += alphabet[byte % alphabet.length];
    return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  }

  async enroll(machineName?: string) {
    const pool = this.db.getMainPool();
    const secret = randomBytes(24).toString('base64url');
    let pairCode = this.makePairCode();
    for (let i = 0; i < 5; i++) {
      const clash = await this.db.executeQuery(
        pool,
        `SELECT 1 FROM branch_agents WHERE pair_code = $1`,
        [pairCode],
      );
      if (!clash.length) break;
      pairCode = this.makePairCode();
    }
    const rows = await this.db.executeQuery(
      pool,
      `INSERT INTO branch_agents (secret_hash, pair_code, pair_expires_at, status, machine_name, last_seen_at)
       VALUES ($1, $2, NOW() + INTERVAL '45 minutes', 'pending_pair', $3, NOW())
       RETURNING id, pair_code, pair_expires_at`,
      [this.hashSecret(secret), pairCode, String(machineName || '').slice(0, 120)],
    );
    const agent = rows[0];
    return {
      agentId: agent.id,
      secret,
      pairCode: agent.pair_code,
      expiresAt: agent.pair_expires_at,
    };
  }

  private async authAgent(agentId: string, secret: string) {
    const pool = this.db.getMainPool();
    const rows = await this.db.executeQuery(
      pool,
      `SELECT * FROM branch_agents WHERE id = $1`,
      [agentId],
    );
    const agent = rows[0];
    if (
      !agent ||
      !this.safeEqualHex(agent.secret_hash, this.hashSecret(secret || ''))
    ) {
      throw new UnauthorizedException('Köprü kimliği geçersiz');
    }
    return agent;
  }

  async poll(agentId: string, secret: string) {
    const agent = await this.authAgent(agentId, secret);
    const pool = this.db.getMainPool();

    // Long-poll YOK. Stale reclaim: read → pending; write → ambiguous (çift UPDATE yok).
    const stale = await this.db.executeQuery(
      pool,
      `SELECT j.id, j.sql, j.params
       FROM agent_jobs j
       INNER JOIN branch_agents a ON a.id = j.agent_id
       WHERE a.id = $1
         AND j.status = 'processing'
         AND j.completed_at IS NULL
         AND j.created_at < NOW() - INTERVAL '90 seconds'
         AND a.last_seen_at < NOW() - INTERVAL '90 seconds'`,
      [agent.id],
    );
    for (const row of stale) {
      if (this.isMutatingJob(row)) {
        await this.db.executeQuery(
          pool,
          `UPDATE agent_jobs
           SET status = 'error', error = $2, completed_at = NOW()
           WHERE id = $1 AND status = 'processing'`,
          [row.id, AMBIGUOUS_WRITE_ERROR],
        );
      } else {
        await this.db.executeQuery(
          pool,
          `UPDATE agent_jobs SET status = 'pending'
           WHERE id = $1 AND status = 'processing'`,
          [row.id],
        );
      }
    }

    await this.db.executeQuery(
      pool,
      `UPDATE branch_agents SET last_seen_at = NOW() WHERE id = $1`,
      [agent.id],
    );

    const claimed = await this.db.executeQuery(
      pool,
      `UPDATE agent_jobs
       SET status = 'processing'
       WHERE id IN (
         SELECT id FROM agent_jobs
         WHERE agent_id = $1 AND status = 'pending'
         ORDER BY created_at ASC
         LIMIT 16
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, sql, params`,
      [agent.id],
    );

    let snapshotMeta: any = null;
    if (agent.status === 'paired' && agent.branch_id) {
      const kasalar = await this.db.executeQuery(
        pool,
        `SELECT kasa_no FROM branch_kasas WHERE branch_id = $1 ORDER BY kasa_no`,
        [agent.branch_id],
      );
      const branchRows = await this.db.executeQuery(
        pool,
        `SELECT kasa_no, closing_hour FROM branches WHERE id = $1`,
        [agent.branch_id],
      );
      const b = branchRows[0] || {};
      const kasaNos = Array.from(
        new Set(
          [
            Number(b.kasa_no) || 1,
            ...kasalar.map((r: any) => Number(r.kasa_no)),
          ].filter((n) => Number.isFinite(n) && n > 0),
        ),
      );
      snapshotMeta = {
        branchId: agent.branch_id,
        kasaNos: kasaNos.length ? kasaNos : [1],
        closingHour: Number.isFinite(Number(b.closing_hour))
          ? Number(b.closing_hour)
          : 6,
        period: 'today',
      };
    }

    return {
      paired: agent.status === 'paired' && !!agent.branch_id,
      pairCode: agent.status === 'pending_pair' ? agent.pair_code : null,
      snapshot: snapshotMeta,
      jobs: claimed.map((job: any) => ({
        id: job.id,
        sql: job.sql,
        params: job.params || [],
      })),
    };
  }

  async saveDashboardSnapshotFromAgent(
    agentId: string,
    secret: string,
    period: string,
    payload: any,
  ) {
    const agent = await this.authAgent(agentId, secret);
    if (!agent.branch_id) {
      throw new BadRequestException('Önce şube ile eşleyin');
    }
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('payload gerekli');
    }
    await this.db.saveDashboardSnapshot(
      Number(agent.branch_id),
      period || 'today',
      payload,
    );
    return { ok: true };
  }

  async completeJob(
    agentId: string,
    secret: string,
    jobId: string,
    rows?: any[],
    error?: string,
    batch?: any[],
  ) {
    const agent = await this.authAgent(agentId, secret);
    const pool = this.db.getMainPool();
    // İlk sonuç kazanır — çift job-result / WS+HTTP yarışında ikinci yazmaz.
    if (error) {
      await this.db.executeQuery(
        pool,
        `UPDATE agent_jobs
         SET status = 'error', error = $3, completed_at = NOW()
         WHERE id = $1 AND agent_id = $2 AND status = 'processing'`,
        [jobId, agent.id, String(error).slice(0, 2000)],
      );
      return { ok: true };
    }
    const payload =
      batch && Array.isArray(batch)
        ? { rows: batch, batch }
        : { rows: rows || [] };
    await this.db.executeQuery(
      pool,
      `UPDATE agent_jobs
       SET status = 'done', result = $3::jsonb, completed_at = NOW()
       WHERE id = $1 AND agent_id = $2 AND status = 'processing'`,
      [jobId, agent.id, JSON.stringify(payload)],
    );
    return { ok: true };
  }

  async pairToUser(
    userId: string,
    data: {
      code: string;
      name?: string;
      kasa_no?: number;
      kasa_name?: string;
      closing_hour?: number;
      kasalar?: Array<number | { kasa_no?: number; name?: string; kasa_name?: string }>;
      kasa_list?: Array<{ kasa_no?: number; name?: string; kasa_name?: string }>;
    },
  ) {
    const code = String(data?.code || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    if (!code) throw new BadRequestException('Eşleme kodu gerekli');
    const pool = this.db.getMainPool();
    const agents = await this.db.executeQuery(
      pool,
      `SELECT * FROM branch_agents
       WHERE replace(pair_code, '-', '') = replace($1, '-', '')
         AND status = 'pending_pair'
         AND pair_expires_at > NOW()
       LIMIT 1`,
      [code],
    );
    const agent = agents[0];
    if (!agent) {
      throw new BadRequestException('Kod geçersiz veya süresi dolmuş. POS uygulamasını yeniden başlatın.');
    }
    const name = String(data?.name || agent.machine_name || 'Köprü şube').trim();
    const kasaNo = Number(data?.kasa_no) || 1;
    const closingHour = Number.isFinite(Number(data?.closing_hour))
      ? Number(data.closing_hour)
      : 6;
    const branchRows = await this.db.executeQuery(
      pool,
      `INSERT INTO branches
         (user_id, name, db_host, db_port, db_name, db_user, db_password, kasa_no, closing_hour, connection_mode, agent_id)
       VALUES ($1, $2, $3, 5432, 'fastrest', 'agent', '', $4, $5, 'agent', $6)
       RETURNING *`,
      [userId, name, `agent:${agent.id}`, kasaNo, closingHour, agent.id],
    );
    const branch = branchRows[0];
    const nameByNo = new Map<number, string | null>();
    const put = (rawNo: any, rawName?: any) => {
      const n = parseInt(String(rawNo), 10);
      if (!Number.isFinite(n) || n <= 0) return;
      const nm =
        rawName != null && String(rawName).trim()
          ? String(rawName).trim().slice(0, 100)
          : null;
      if (!nameByNo.has(n)) nameByNo.set(n, nm);
      else if (nm) nameByNo.set(n, nm);
    };
    put(kasaNo, data?.kasa_name);
    for (const item of [
      ...(Array.isArray(data?.kasa_list) ? data.kasa_list : []),
      ...(Array.isArray(data?.kasalar) ? data.kasalar : []),
    ]) {
      if (item != null && typeof item === 'object') {
        put((item as any).kasa_no, (item as any).name ?? (item as any).kasa_name);
      } else {
        put(item);
      }
    }
    for (const [kasa, kasaName] of nameByNo.entries()) {
      await this.db.executeQuery(
        pool,
        'INSERT INTO branch_kasas (branch_id, kasa_no, kasa_name) VALUES ($1, $2, $3)',
        [branch.id, kasa, kasaName],
      );
    }
    await this.db.executeQuery(
      pool,
      `INSERT INTO user_branch_assignments (user_id, branch_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM user_branch_assignments WHERE user_id = $1 AND branch_id = $2
       )`,
      [userId, branch.id],
    );
    await this.db.executeQuery(
      pool,
      `UPDATE branch_agents
       SET status = 'paired', branch_id = $2, pair_code = NULL
       WHERE id = $1`,
      [agent.id, branch.id],
    );
    await this.cache.del(this.cache.generateKey('branches', 'user', userId));
    return { ...branch, pairOk: true };
  }

  /** Mevcut agent subeyi yeni kod ile yeniden esle (silmeye gerek yok). */
  async repairBranch(userId: string, data: { code: string; branchId: number }) {
    const branchId = Number(data?.branchId);
    if (!Number.isFinite(branchId) || branchId <= 0) {
      throw new BadRequestException('Şube seçili değil');
    }
    const code = String(data?.code || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    if (!code) throw new BadRequestException('Eşleme kodu gerekli');

    const pool = this.db.getMainPool();
    const branches = await this.db.executeQuery(
      pool,
      `SELECT * FROM branches WHERE id = $1`,
      [branchId],
    );
    const branch = branches[0];
    if (!branch) throw new BadRequestException('Şube bulunamadı');

    const agents = await this.db.executeQuery(
      pool,
      `SELECT * FROM branch_agents
       WHERE replace(pair_code, '-', '') = replace($1, '-', '')
         AND status = 'pending_pair'
         AND pair_expires_at > NOW()
       LIMIT 1`,
      [code],
    );
    const agent = agents[0];
    if (!agent) {
      throw new BadRequestException(
        'Kod geçersiz veya süresi dolmuş. POS’ta FrRaporBridge’i yeniden başlatın.',
      );
    }

    const oldAgentId = branch.agent_id;
    if (oldAgentId && String(oldAgentId) !== String(agent.id)) {
      await this.db.executeQuery(
        pool,
        `UPDATE branch_agents
         SET status = 'replaced', branch_id = NULL, pair_code = NULL
         WHERE id = $1`,
        [oldAgentId],
      );
    }

    await this.db.executeQuery(
      pool,
      `UPDATE branches
       SET db_host = $2,
           db_port = 5432,
           db_name = 'fastrest',
           db_user = 'agent',
           db_password = '',
           connection_mode = 'agent',
           agent_id = $3
       WHERE id = $1`,
      [branchId, `agent:${agent.id}`, agent.id],
    );
    await this.db.executeQuery(
      pool,
      `UPDATE branch_agents
       SET status = 'paired', branch_id = $2, pair_code = NULL
       WHERE id = $1`,
      [agent.id, branchId],
    );

    await this.cache.del(this.cache.generateKey('branches', 'user', userId));
    const updated = await this.db.executeQuery(
      pool,
      `SELECT * FROM branches WHERE id = $1`,
      [branchId],
    );
    return { ...updated[0], pairOk: true, repaired: true };
  }
}
