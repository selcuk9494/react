'use strict';

/**
 * WS claimer vs HTTP poll claimer yarışı — SKIP LOCKED tek execution.
 * In-memory store (gerçek PG yok).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMutatingJob, AMBIGUOUS_WRITE_ERROR } = require('../src/sql-safety');

function createStore() {
  const jobs = new Map();
  let seq = 0;
  let lastSeen = Date.now();
  return {
    setLastSeen(ts) {
      lastSeen = ts;
    },
    insert(sql, params = []) {
      const id = `j-${++seq}`;
      jobs.set(id, {
        id,
        sql,
        params,
        status: 'pending',
        error: null,
        createdAt: Date.now() - 120_000,
        completedAt: null,
        runCount: 0,
      });
      return id;
    },
    /** İki eşzamanlı claimer — her job en fazla bir kez */
    async claim(limit = 16) {
      await new Promise((r) => setImmediate(r));
      const out = [];
      for (const job of jobs.values()) {
        if (job.status !== 'pending') continue;
        job.status = 'processing';
        out.push({ id: job.id, sql: job.sql, params: job.params });
        if (out.length >= limit) break;
      }
      return out;
    },
    reclaimStale(now = Date.now()) {
      if (now - lastSeen < 90_000) return { pending: 0, ambiguous: 0 };
      let pending = 0;
      let ambiguous = 0;
      for (const job of jobs.values()) {
        if (job.status !== 'processing' || job.completedAt) continue;
        if (now - job.createdAt < 90_000) continue;
        if (isMutatingJob(job)) {
          job.status = 'error';
          job.error = AMBIGUOUS_WRITE_ERROR;
          job.completedAt = now;
          ambiguous++;
        } else {
          job.status = 'pending';
          pending++;
        }
      }
      return { pending, ambiguous };
    },
    executeLocal(job, localSeen) {
      if (localSeen.has(job.id)) return 'skipped';
      localSeen.add(job.id);
      const row = jobs.get(job.id);
      if (row) row.runCount += 1;
      return 'ran';
    },
    get(id) {
      return jobs.get(id);
    },
  };
}

test('WS + HTTP aynı anda claim → tek job tek claimer', async () => {
  const store = createStore();
  const id = store.insert('SELECT 1');
  const [wsJobs, httpJobs] = await Promise.all([store.claim(16), store.claim(16)]);
  const all = [...wsJobs, ...httpJobs];
  assert.equal(all.length, 1);
  assert.equal(all[0].id, id);
  assert.equal(store.get(id).status, 'processing');
});

test('local dedup: aynı job ikinci kanaldan gelse bile tek execution', async () => {
  const store = createStore();
  const id = store.insert('UPDATE t SET a=1');
  const claimed = await store.claim();
  const localSeen = new Set();
  // WS ve HTTP aynı claimed listesini "aldı" senaryosu
  assert.equal(store.executeLocal(claimed[0], localSeen), 'ran');
  assert.equal(store.executeLocal(claimed[0], localSeen), 'skipped');
  assert.equal(store.get(id).runCount, 1);
});

test('stale WRITE reclaim → ambiguous, yeniden pending olmaz', () => {
  const store = createStore();
  const id = store.insert('UPDATE ads_acik SET x=1');
  store.get(id).status = 'processing';
  store.setLastSeen(Date.now() - 120_000);
  const r = store.reclaimStale(Date.now());
  assert.equal(r.ambiguous, 1);
  assert.equal(r.pending, 0);
  assert.equal(store.get(id).status, 'error');
  assert.equal(store.get(id).error, AMBIGUOUS_WRITE_ERROR);
});

test('stale SELECT reclaim → pending (retry OK)', () => {
  const store = createStore();
  const id = store.insert('SELECT * FROM ads_acik');
  store.get(id).status = 'processing';
  store.setLastSeen(Date.now() - 120_000);
  const r = store.reclaimStale(Date.now());
  assert.equal(r.pending, 1);
  assert.equal(store.get(id).status, 'pending');
});

test('NOTIFY kaybı: safety poll claim eder', async () => {
  const store = createStore();
  const id = store.insert('SELECT 1');
  // NOTIFY yok — sadece safety poll = claim
  const jobs = await store.claim();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, id);
});
