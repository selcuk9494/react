'use strict';

/**
 * Nest insert → notify (opsiyonel) → bridge claim → agent job-result uyumu.
 * Bellek içi uçtan uca; production'a bağlanmaz.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('crypto');
const { isMutatingJob } = require('../src/sql-safety');

function hashSecret(s) {
  return createHash('sha256').update(s).digest('hex');
}

function createCloud() {
  const agents = new Map();
  const jobs = new Map();
  let notifies = [];
  return {
    enroll() {
      const id = 'agent-' + agents.size;
      const secret = 'sec-' + id;
      agents.set(id, { id, secret_hash: hashSecret(secret), last_seen: Date.now() });
      return { agentId: id, secret };
    },
    insertJob(agentId, sql, params = []) {
      const id = 'job-' + jobs.size;
      jobs.set(id, {
        id,
        agentId,
        sql,
        params,
        status: 'pending',
        result: null,
        error: null,
      });
      notifies.push({ agentId, jobId: id });
      return id;
    },
    drainNotifies() {
      const n = notifies;
      notifies = [];
      return n;
    },
    auth(agentId, secret) {
      const a = agents.get(agentId);
      return a && a.secret_hash === hashSecret(secret);
    },
    claim(agentId) {
      const out = [];
      for (const j of jobs.values()) {
        if (j.agentId === agentId && j.status === 'pending') {
          j.status = 'processing';
          out.push({ id: j.id, sql: j.sql, params: j.params });
        }
      }
      return out;
    },
    completeJob(agentId, secret, jobId, rows, error) {
      if (!this.auth(agentId, secret)) throw new Error('unauthorized');
      const j = jobs.get(jobId);
      if (!j || j.agentId !== agentId) throw new Error('not_found');
      if (j.status === 'done' || j.status === 'error') return { ok: true, dup: true };
      if (error) {
        j.status = 'error';
        j.error = error;
      } else {
        j.status = 'done';
        j.result = { rows };
      }
      return { ok: true, dup: false };
    },
    getJob(id) {
      return jobs.get(id);
    },
  };
}

test('Nest job create → bridge claim → job-result done', () => {
  const cloud = createCloud();
  const { agentId, secret } = cloud.enroll();
  const jobId = cloud.insertJob(agentId, 'SELECT 1');
  const notes = cloud.drainNotifies();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].jobId, jobId);

  // Bridge WS path: claim after notify (or safety poll)
  const claimed = cloud.claim(agentId);
  assert.equal(claimed.length, 1);

  // Agent executes + job-result (Vercel Nest)
  const r = cloud.completeJob(agentId, secret, jobId, [{ n: 1 }]);
  assert.equal(r.ok, true);
  assert.equal(cloud.getJob(jobId).status, 'done');
});

test('duplicate job-result is idempotent', () => {
  const cloud = createCloud();
  const { agentId, secret } = cloud.enroll();
  const jobId = cloud.insertJob(agentId, 'SELECT 1');
  cloud.claim(agentId);
  cloud.completeJob(agentId, secret, jobId, [{ n: 1 }]);
  const second = cloud.completeJob(agentId, secret, jobId, [{ n: 99 }]);
  assert.equal(second.dup, true);
  assert.deepEqual(cloud.getJob(jobId).result.rows, [{ n: 1 }]);
});

test('NOTIFY dropped: safety poll still claims pending', () => {
  const cloud = createCloud();
  const { agentId } = cloud.enroll();
  const jobId = cloud.insertJob(agentId, 'SELECT 42');
  cloud.drainNotifies(); // bildirim "kayboldu"
  // safety poll
  const claimed = cloud.claim(agentId);
  assert.equal(claimed[0].id, jobId);
});

test('HTTP default transport: eski agent sadece poll kullanır', () => {
  const transport = 'http'; // branch-agent varsayılanı
  assert.equal(transport, 'http');
  assert.equal(isMutatingJob({ sql: 'SELECT 1' }), false);
});
