'use strict';

/**
 * agent_jobs kuyruk semantiğinin bellek içi simülasyonu.
 * Gerçek PG yok; FOR UPDATE SKIP LOCKED / reclaim / timeout davranışını modeler.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextDelayMs, createSingleFlight, IDLE_POLL_MS } = require('./poll-policy');

function createJobStore() {
  /** @type {Map<string, any>} */
  const jobs = new Map();
  let seq = 0;
  let agentLastSeen = Date.now();

  return {
    setLastSeen(ts) {
      agentLastSeen = ts;
    },
    getLastSeen() {
      return agentLastSeen;
    },
    insert(sql) {
      const id = `job-${++seq}`;
      jobs.set(id, {
        id,
        sql,
        status: 'pending',
        result: null,
        error: null,
        createdAt: Date.now(),
        completedAt: null,
        runCount: 0,
      });
      return id;
    },
    /** SKIP LOCKED: sadece pending; aynı anda tek claimer */
    claim(limit = 16) {
      const out = [];
      for (const job of jobs.values()) {
        if (job.status !== 'pending') continue;
        job.status = 'processing';
        out.push(job);
        if (out.length >= limit) break;
      }
      return out;
    },
    complete(id, rows) {
      const job = jobs.get(id);
      if (!job) return false;
      job.status = 'done';
      job.result = { rows };
      job.completedAt = Date.now();
      return true;
    },
    fail(id, error) {
      const job = jobs.get(id);
      if (!job) return false;
      job.status = 'error';
      job.error = error;
      job.completedAt = Date.now();
      return true;
    },
    /** Production poll reclaim: sadece agent 90s sessizse */
    reclaimStale(now = Date.now(), silentMs = 90000, jobAgeMs = 90000) {
      if (now - agentLastSeen < silentMs) return 0;
      let n = 0;
      for (const job of jobs.values()) {
        if (
          job.status === 'processing' &&
          !job.completedAt &&
          now - job.createdAt >= jobAgeMs
        ) {
          job.status = 'pending';
          n++;
        }
      }
      return n;
    },
    /** Eski (güvensiz) reclaim: sadece job yaşı — aktif agent'ta çift koşu riski */
    reclaimStaleUnsafe(now = Date.now(), jobAgeMs = 90000) {
      let n = 0;
      for (const job of jobs.values()) {
        if (
          job.status === 'processing' &&
          !job.completedAt &&
          now - job.createdAt >= jobAgeMs
        ) {
          job.status = 'pending';
          n++;
        }
      }
      return n;
    },
    get(id) {
      return jobs.get(id);
    },
    pendingCount() {
      return [...jobs.values()].filter((j) => j.status === 'pending').length;
    },
    all() {
      return [...jobs.values()];
    },
  };
}

async function waitJob(store, id, timeoutMs, pollMs = 25) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = store.get(id);
    if (job?.status === 'done' || job?.status === 'error') return job;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  store.fail(id, 'timeout');
  return store.get(id);
}

test('3s idle only gates cloud→POS SQL relay; policy constants', () => {
  assert.equal(IDLE_POLL_MS, 3000);
  assert.equal(nextDelayMs({ hadJobs: true, errorStreak: 0 }), 0);
});

test('concurrent waiters + 3s agent pick-up finish inside 20s timeout', async () => {
  const store = createJobStore();
  const ids = [store.insert('SELECT 1'), store.insert('SELECT 2'), store.insert('SELECT 3')];

  // Sunucu tarafi: 3 eszamanli wait (20s)
  const waits = ids.map((id) => waitJob(store, id, 20000, 20));

  // Agent: en kotu senaryo 3s idle sonra claim + execute
  await new Promise((r) => setTimeout(r, 3000));
  const claimed = store.claim(16);
  assert.equal(claimed.length, 3);
  for (const job of claimed) {
    job.runCount++;
    store.complete(job.id, [{ ok: true }]);
  }

  const results = await Promise.all(waits);
  assert.ok(results.every((j) => j.status === 'done'));
  const elapsedOk = results.every((j) => j.completedAt - j.createdAt < 20000);
  assert.ok(elapsedOk);
});

test('two agents cannot claim the same pending job (SKIP LOCKED model)', () => {
  const store = createJobStore();
  const id = store.insert('SELECT race');
  const a = store.claim(1);
  const b = store.claim(1);
  assert.equal(a.length, 1);
  assert.equal(a[0].id, id);
  assert.equal(b.length, 0);
  assert.equal(store.get(id).status, 'processing');
});

test('safe reclaim does not re-queue while agent is freshly seen (no double run)', () => {
  const store = createJobStore();
  const id = store.insert('UPDATE product SET x=1');
  store.claim(1);
  store.get(id).createdAt = Date.now() - 120000; // job eski
  store.setLastSeen(Date.now()); // agent az once poll atti
  const n = store.reclaimStale(Date.now(), 90000, 90000);
  assert.equal(n, 0, 'aktif agent varken reclaim olmamali');
  assert.equal(store.get(id).status, 'processing');
});

test('safe reclaim re-queues only after agent silent 90s', () => {
  const store = createJobStore();
  const id = store.insert('SELECT orphan');
  store.claim(1);
  store.get(id).createdAt = Date.now() - 120000;
  store.setLastSeen(Date.now() - 120000); // agent dustu
  const n = store.reclaimStale(Date.now(), 90000, 90000);
  assert.equal(n, 1);
  assert.equal(store.get(id).status, 'pending');
  const again = store.claim(1);
  assert.equal(again.length, 1);
  again[0].runCount++;
  store.complete(again[0].id, []);
  assert.equal(store.get(id).runCount, 1);
});

test('unsafe age-only reclaim would allow double claim while agent still working', () => {
  const store = createJobStore();
  const id = store.insert('UPDATE risky');
  const first = store.claim(1);
  store.get(id).createdAt = Date.now() - 120000;
  store.setLastSeen(Date.now()); // hala canli
  const n = store.reclaimStaleUnsafe(Date.now(), 90000);
  assert.equal(n, 1);
  const second = store.claim(1);
  assert.equal(second.length, 1);
  assert.equal(second[0].id, first[0].id);
  // Bu senaryo production'da engellendi (last_seen sarti)
});

test('disconnect/restart: pending jobs survive; in-flight completed once', () => {
  const store = createJobStore();
  const activeId = store.insert('SELECT active');
  store.claim(1); // active → processing
  const pendingId = store.insert('SELECT pending');
  // "restart": new single-flight loop; pending still pending
  assert.equal(store.get(pendingId).status, 'pending');
  assert.equal(store.get(activeId).status, 'processing');
  store.complete(activeId, []);
  const claimed = store.claim(8);
  assert.equal(claimed.map((j) => j.id).join(','), pendingId);
  store.complete(pendingId, []);
  assert.ok(store.all().every((j) => j.status === 'done'));
});

test('error backoff does not delete or alter pending jobs', () => {
  const store = createJobStore();
  const id = store.insert('SELECT keep');
  const streak = 3;
  const delay = nextDelayMs({ hadJobs: false, errorStreak: streak, random: () => 0.5 });
  assert.ok(delay >= 8000);
  assert.equal(store.get(id).status, 'pending');
  assert.equal(store.pendingCount(), 1);
});

test('single-flight prevents overlapping poll loops for same process', async () => {
  const flight = createSingleFlight();
  assert.equal(flight.tryEnter(), true);
  let entered = false;
  const fakeSecond = async () => {
    if (!flight.tryEnter()) return 'blocked';
    entered = true;
    flight.leave();
    return 'ran';
  };
  assert.equal(await fakeSecond(), 'blocked');
  assert.equal(entered, false);
  flight.leave();
  assert.equal(await fakeSecond(), 'ran');
});

test('old agent timing (600ms idle) still compatible with 20s waiter', async () => {
  const store = createJobStore();
  const id = store.insert('SELECT legacy');
  const wait = waitJob(store, id, 20000, 20);
  await new Promise((r) => setTimeout(r, 600)); // eski idle
  const [job] = store.claim(1);
  store.complete(job.id, [{ v: 1 }]);
  const row = await wait;
  assert.equal(row.status, 'done');
});
