'use strict';

const { createHash, timingSafeEqual } = require('crypto');
const { isMutatingJob, AMBIGUOUS_WRITE_ERROR } = require('./sql-safety');

function hashSecret(secret) {
  return createHash('sha256').update(String(secret || '')).digest('hex');
}

function safeEqualHex(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  try {
    return timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

/**
 * Nest agent.service.poll ile aynı claim / reclaim semantiği + yazma güvenliği.
 */
async function authAgent(pool, agentId, secret) {
  const { rows } = await pool.query(`SELECT * FROM branch_agents WHERE id = $1`, [
    agentId,
  ]);
  const agent = rows[0];
  if (!agent || !safeEqualHex(agent.secret_hash, hashSecret(secret))) {
    return null;
  }
  return agent;
}

async function touchLastSeen(pool, agentId) {
  await pool.query(`UPDATE branch_agents SET last_seen_at = NOW() WHERE id = $1`, [
    agentId,
  ]);
}

/**
 * Stale processing:
 * - SELECT (read): pending'e geri al → yeniden claim edilebilir
 * - WRITE: error=ambiguous_write_needs_review → OTOMATİK YENİDEN ÇALIŞTIRMA YOK
 */
async function reclaimStale(pool, agentId) {
  const { rows } = await pool.query(
    `SELECT j.id, j.sql, j.params
     FROM agent_jobs j
     INNER JOIN branch_agents a ON a.id = j.agent_id
     WHERE a.id = $1
       AND j.status = 'processing'
       AND j.completed_at IS NULL
       AND j.created_at < NOW() - INTERVAL '90 seconds'
       AND a.last_seen_at < NOW() - INTERVAL '90 seconds'`,
    [agentId],
  );
  for (const row of rows) {
    if (isMutatingJob(row)) {
      await pool.query(
        `UPDATE agent_jobs
         SET status = 'error', error = $2, completed_at = NOW()
         WHERE id = $1 AND status = 'processing'`,
        [row.id, AMBIGUOUS_WRITE_ERROR],
      );
    } else {
      await pool.query(
        `UPDATE agent_jobs SET status = 'pending'
         WHERE id = $1 AND status = 'processing'`,
        [row.id],
      );
    }
  }
  return rows.length;
}

async function claimJobs(pool, agentId, limit = 16) {
  const { rows } = await pool.query(
    `UPDATE agent_jobs
     SET status = 'processing'
     WHERE id IN (
       SELECT id FROM agent_jobs
       WHERE agent_id = $1 AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, sql, params`,
    [agentId, limit],
  );
  return rows.map((job) => ({
    id: job.id,
    sql: job.sql,
    params: job.params || [],
  }));
}

/**
 * Claim sonrası WS gönderilemezse: read → pending; write → manual review (çift UPDATE yok).
 */
async function releaseUnsentJobs(pool, jobs) {
  let released = 0;
  let quarantined = 0;
  for (const job of jobs || []) {
    if (isMutatingJob(job)) {
      await pool.query(
        `UPDATE agent_jobs
         SET status = 'error', error = $2, completed_at = NOW()
         WHERE id = $1 AND status = 'processing'`,
        [job.id, AMBIGUOUS_WRITE_ERROR],
      );
      quarantined += 1;
    } else {
      await pool.query(
        `UPDATE agent_jobs SET status = 'pending'
         WHERE id = $1 AND status = 'processing'`,
        [job.id],
      );
      released += 1;
    }
  }
  return { released, quarantined };
}

async function buildSnapshotMeta(pool, agent) {
  if (agent.status !== 'paired' || !agent.branch_id) return null;
  const kasalar = await pool.query(
    `SELECT kasa_no FROM branch_kasas WHERE branch_id = $1 ORDER BY kasa_no`,
    [agent.branch_id],
  );
  const branchRows = await pool.query(
    `SELECT kasa_no, closing_hour FROM branches WHERE id = $1`,
    [agent.branch_id],
  );
  const b = branchRows.rows[0] || {};
  const kasaNos = Array.from(
    new Set(
      [
        Number(b.kasa_no) || 1,
        ...kasalar.rows.map((r) => Number(r.kasa_no)),
      ].filter((n) => Number.isFinite(n) && n > 0),
    ),
  );
  return {
    branchId: agent.branch_id,
    kasaNos: kasaNos.length ? kasaNos : [1],
    closingHour: Number.isFinite(Number(b.closing_hour))
      ? Number(b.closing_hour)
      : 6,
    period: 'today',
  };
}

async function sessionPayload(pool, agent) {
  await touchLastSeen(pool, agent.id);
  const snapshot = await buildSnapshotMeta(pool, agent);
  return {
    paired: agent.status === 'paired' && !!agent.branch_id,
    pairCode: agent.status === 'pending_pair' ? agent.pair_code : null,
    snapshot,
  };
}

async function pullJobsForAgent(pool, agentId) {
  await reclaimStale(pool, agentId);
  await touchLastSeen(pool, agentId);
  return claimJobs(pool, agentId);
}

module.exports = {
  hashSecret,
  safeEqualHex,
  authAgent,
  touchLastSeen,
  reclaimStale,
  claimJobs,
  releaseUnsentJobs,
  buildSnapshotMeta,
  sessionPayload,
  pullJobsForAgent,
};
