'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const { Pool } = require('pg');
const { loadConfig } = require('./config');
const { createConnectionRegistry } = require('./connections');
const {
  authAgent,
  sessionPayload,
  pullJobsForAgent,
  touchLastSeen,
  releaseUnsentJobs,
  hashSecret,
} = require('./jobs');
const { createListenManager } = require('./listen');
const { classifyDatabaseTarget, redactErrorMessage } = require('./db-url-meta');
const { createRuntimeStatus } = require('./runtime-status');

const config = loadConfig();
const registry = createConnectionRegistry(config.maxAgents);
const testMode = String(process.env.BRIDGE_TEST_MODE || '') === '1';
const runtime = createRuntimeStatus();
let listenManager = null;

function makePool() {
  if (testMode) {
    runtime.postgres.ok = true;
    runtime.postgres.lastCheckAt = new Date().toISOString();
    return {
      async query(sql, params) {
        if (/FROM branch_agents WHERE id/i.test(sql)) {
          const id = params?.[0];
          return {
            rows: [
              {
                id,
                secret_hash: hashSecret('load-test-secret'),
                status: 'paired',
                branch_id: 1,
                pair_code: null,
                last_seen_at: new Date(),
              },
            ],
          };
        }
        if (/UPDATE branch_agents SET last_seen/i.test(sql)) return { rows: [] };
        if (/FROM branch_kasas|FROM branches WHERE id/i.test(sql)) {
          return { rows: [{ kasa_no: 1, closing_hour: 6 }] };
        }
        if (/FOR UPDATE SKIP LOCKED/i.test(sql)) return { rows: [] };
        if (/status = 'processing'/i.test(sql) && /SELECT j\.id/i.test(sql)) {
          return { rows: [] };
        }
        if (/^SELECT 1\b/i.test(String(sql))) return { rows: [{ ok: 1 }] };
        return { rows: [] };
      },
      async end() {},
      on() {},
    };
  }
  const poolMax = config.poolMax;
  if (config.databaseUrl) {
    return new Pool({
      connectionString: config.databaseUrl,
      ssl: config.ssl,
      max: poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return new Pool({
    ...config.db,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
}

const pool = makePool();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function makeClientConfig() {
  if (config.databaseUrl) {
    return {
      connectionString: config.databaseUrl,
      ssl: config.ssl,
      connectionTimeoutMillis: 8_000,
    };
  }
  return {
    ...config.db,
    connectionTimeoutMillis: 8_000,
  };
}

async function probePostgres() {
  try {
    await pool.query('SELECT 1 AS ok');
    runtime.postgres.ok = true;
    runtime.postgres.lastError = null;
    runtime.postgres.lastCheckAt = new Date().toISOString();
    return true;
  } catch (err) {
    runtime.postgres.ok = false;
    runtime.postgres.lastError = redactErrorMessage(err.message || err);
    runtime.postgres.lastCheckAt = new Date().toISOString();
    return false;
  }
}

function syncListenStatus() {
  if (!listenManager) {
    runtime.listen.listening = false;
    return;
  }
  const s = listenManager.getStatus();
  runtime.listen = {
    listening: !!s.listening,
    lastError: s.lastError,
    lastConnectedAt: s.lastConnectedAt,
    lastNotifyAt: s.lastNotifyAt,
    attempts: s.attempts,
    channel: s.channel,
  };
}

function send(ws, payload) {
  if (ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch (_) {}
}

async function pushJobs(agentId) {
  if (!registry.has(agentId)) return;
  try {
    const jobs = await pullJobsForAgent(pool, agentId);
    if (!jobs.length) return;
    const ok = registry.send(agentId, { type: 'jobs', jobs });
    if (!ok) {
      const r = await releaseUnsentJobs(pool, jobs);
      log(
        'push failed — unsent released/quarantined',
        agentId,
        'jobs=',
        jobs.length,
        r,
      );
    } else log('pushed jobs', agentId, jobs.length);
  } catch (err) {
    log('pushJobs error', agentId, redactErrorMessage(err.message || err));
  }
}

async function onAuth(ws, msg) {
  const agentId = String(msg.agentId || '').trim();
  const secret = String(msg.secret || '');
  if (!agentId || !secret) {
    send(ws, { type: 'auth.err', error: 'agentId/secret gerekli' });
    ws.close(4001, 'auth');
    return;
  }
  if (testMode && secret !== 'load-test-secret') {
    send(ws, { type: 'auth.err', error: 'Köprü kimliği geçersiz' });
    ws.close(4003, 'unauthorized');
    return;
  }
  const agent = await authAgent(pool, agentId, secret);
  if (!agent) {
    send(ws, { type: 'auth.err', error: 'Köprü kimliği geçersiz' });
    ws.close(4003, 'unauthorized');
    return;
  }
  const placed = registry.set(agentId, ws, { status: agent.status });
  if (!placed.ok) {
    send(ws, { type: 'auth.err', error: 'max_agents' });
    ws.close(4010, 'max_agents');
    return;
  }
  ws.agentId = agentId;
  const session = await sessionPayload(pool, agent);
  send(ws, { type: 'auth.ok', ...session });
  log('agent connected', agentId, 'paired=', session.paired, 'n=', registry.size());
  await pushJobs(agentId);
}

async function onPing(ws) {
  const agentId = ws.agentId;
  if (!agentId) return;
  registry.touch(agentId);
  await touchLastSeen(pool, agentId);
  const { rows } = await pool.query(`SELECT * FROM branch_agents WHERE id = $1`, [
    agentId,
  ]);
  const agent = rows[0];
  if (!agent) return;
  const session = await sessionPayload(pool, agent);
  send(ws, { type: 'pong', ...session });
}

function attachWs(wss) {
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        send(ws, { type: 'error', error: 'invalid_json' });
        return;
      }
      const type = String(msg.type || '');
      if (type === 'auth') {
        void onAuth(ws, msg).catch((err) => {
          log('auth error', redactErrorMessage(err.message || err));
          send(ws, { type: 'auth.err', error: 'auth_failed' });
          ws.close(4011, 'auth_failed');
        });
        return;
      }
      if (!ws.agentId) {
        send(ws, { type: 'error', error: 'auth_required' });
        return;
      }
      if (type === 'ping') {
        void onPing(ws).catch((err) =>
          log('ping error', redactErrorMessage(err.message || err)),
        );
        return;
      }
      if (type === 'jobs.ack') {
        registry.touch(ws.agentId);
        return;
      }
      send(ws, { type: 'error', error: 'unknown_type' });
    });

    ws.on('close', () => {
      if (ws.agentId) {
        registry.remove(ws.agentId, ws);
        log('agent disconnected', ws.agentId, 'n=', registry.size());
      }
    });

    ws.on('error', (err) => {
      log('ws error', ws.agentId || '-', redactErrorMessage(err.message || err));
    });

    setTimeout(() => {
      if (!ws.agentId && ws.readyState === 1) {
        ws.close(4002, 'auth_timeout');
      }
    }, 15_000).unref?.();
  });

  const iv = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        try {
          client.terminate();
        } catch (_) {}
        continue;
      }
      client.isAlive = false;
      try {
        client.ping();
      } catch (_) {}
    }
  }, 30_000);
  iv.unref?.();
}

function buildHealthPayload() {
  syncListenStatus();
  const dbOk = runtime.postgres.ok;
  const listenWanted = !testMode && !!(config.databaseUrl || config.db);
  const listenOk = testMode ? true : runtime.listen.listening;
  // DB zorunlu. LISTEN production'da zorunlu; düşmüşse 503 (safety poll tek başına sağlıklı sayılmaz).
  const healthy = dbOk && (!listenWanted || listenOk);

  return {
    ok: healthy,
    degraded: false,
    service: 'fr-bridge-server',
    agents: registry.size(),
    maxAgents: config.maxAgents,
    postgres: {
      ok: runtime.postgres.ok,
      lastCheckAt: runtime.postgres.lastCheckAt,
      lastError: runtime.postgres.lastError,
    },
    listen: {
      ok: runtime.listen.listening,
      channel: runtime.listen.channel || config.channel,
      lastConnectedAt: runtime.listen.lastConnectedAt,
      lastError: runtime.listen.lastError,
      attempts: runtime.listen.attempts,
    },
    safetyPoll: {
      lastOkAt: runtime.safetyPoll.lastOkAt,
      lastErrorAt: runtime.safetyPoll.lastErrorAt,
      consecutiveFailures: runtime.safetyPoll.consecutiveFailures,
      lastError: runtime.safetyPoll.lastError,
    },
    time: new Date().toISOString(),
  };
}

function startHttp() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      await probePostgres();
      syncListenStatus();
      const body = buildHealthPayload();
      const code = body.ok ? 200 : 503;
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/internal/job-notify') {
      if (!config.internalSecret) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'notify_disabled' }));
        return;
      }
      const hdr = String(req.headers['x-bridge-secret'] || '');
      if (hdr !== config.internalSecret) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }
      let body = '';
      for await (const chunk of req) body += chunk;
      let payload = {};
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
        return;
      }
      const agentId = String(payload.agentId || '').trim();
      if (!agentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'agentId_required' }));
        return;
      }
      void pushJobs(agentId);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, connected: registry.has(agentId) }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  attachWs(wss);

  server.listen(config.port, '0.0.0.0', () => {
    log(`fr-bridge-server listening :${config.port} ws=/ws max=${config.maxAgents}`);
  });

  return { server, wss };
}

function startListen() {
  if (testMode || (!config.databaseUrl && !config.db)) {
    log('LISTEN skipped (test mode or no DB)');
    runtime.listen.listening = testMode;
    return null;
  }

  const meta = classifyDatabaseTarget(config.databaseUrl, config.db);
  log(
    'DB target class=',
    meta.kind,
    'ipv4Hint=',
    meta.ipv4Hint,
    'listenProtocolOk=',
    meta.listenOk,
  );
  log('DB advice:', meta.advice);
  if (!meta.listenOk) {
    log('WARNING: current DATABASE_URL class is not suitable for LISTEN');
  }

  listenManager = createListenManager({
    channel: config.channel,
    makeClientConfig,
    log,
    onNotify(msg) {
      try {
        const data = msg.payload ? JSON.parse(msg.payload) : {};
        const agentId = String(data.agentId || '').trim();
        if (agentId) void pushJobs(agentId);
      } catch (err) {
        log('notify parse error', redactErrorMessage(err.message || err));
      }
    },
  });
  listenManager.start();
  return listenManager;
}

function startSafetyPoll() {
  let tickRunning = false;
  const iv = setInterval(() => {
    void (async () => {
      if (tickRunning) return;
      tickRunning = true;
      try {
        const dbOk = await probePostgres();
        if (!dbOk) {
          runtime.safetyPoll.consecutiveFailures += 1;
          runtime.safetyPoll.lastErrorAt = new Date().toISOString();
          runtime.safetyPoll.lastError = runtime.postgres.lastError;
          log(
            'safety poll: PostgreSQL unreachable',
            `failures=${runtime.safetyPoll.consecutiveFailures}`,
            runtime.postgres.lastError,
          );
          return;
        }
        runtime.safetyPoll.consecutiveFailures = 0;
        runtime.safetyPoll.lastOkAt = new Date().toISOString();
        runtime.safetyPoll.lastError = null;

        const ids = registry.listIds();
        for (const agentId of ids) {
          try {
            await pushJobs(agentId);
          } catch (err) {
            log(
              'safety poll pushJobs error',
              agentId,
              redactErrorMessage(err.message || err),
            );
          }
        }
      } finally {
        tickRunning = false;
      }
    })();
  }, config.safetyPollMs);
  iv.unref?.();
  log('safety poll ms=', config.safetyPollMs, '(reports DB errors; timer alone ≠ healthy)');
}

async function main() {
  startHttp();
  await probePostgres();
  if (!runtime.postgres.ok && !testMode) {
    log('WARNING: initial PostgreSQL probe failed:', runtime.postgres.lastError);
  }
  startListen();
  startSafetyPoll();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('fatal', redactErrorMessage(err && err.message ? err.message : err));
    process.exit(1);
  });
}

module.exports = {
  buildHealthPayload,
  probePostgres,
  runtime,
  classifyDatabaseTarget,
};
