'use strict';

const { resolvePgSsl, sslMeta } = require('./pg-ssl');

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function loadConfig() {
  const port = Number(process.env.PORT || 8080);
  const testMode = String(process.env.BRIDGE_TEST_MODE || '') === '1';
  const databaseUrl = process.env.DATABASE_URL || '';
  const dbHost = process.env.DB_HOST || '';
  const hasUrl = Boolean(databaseUrl);
  const hasParts = Boolean(dbHost);

  if (!testMode && !hasUrl && !hasParts) {
    throw new Error('Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD');
  }

  const ssl = testMode
    ? false
    : resolvePgSsl({
        databaseUrl: hasUrl ? databaseUrl : null,
        host: dbHost,
      });

  return {
    port,
    testMode,
    databaseUrl: hasUrl ? databaseUrl : null,
    db:
      hasUrl || testMode
        ? null
        : {
            host: dbHost,
            port: Number(process.env.DB_PORT || 5432),
            database: process.env.DB_NAME || process.env.DB_DATABASE || 'postgres',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            // ssl ayrı alanda; db parçalarına gömme (çift kaynak olmasın)
          },
    ssl,
    sslMeta: sslMeta(ssl),
    internalSecret: process.env.BRIDGE_INTERNAL_SECRET || '',
    safetyPollMs: Math.max(1000, Number(process.env.BRIDGE_SAFETY_POLL_MS || 2000)),
    heartbeatTtlMs: Math.max(30_000, Number(process.env.BRIDGE_HEARTBEAT_TTL_MS || 90_000)),
    maxAgents: Math.max(1, Number(process.env.BRIDGE_MAX_AGENTS || 50)),
    poolMax: Math.max(2, Number(process.env.BRIDGE_PG_POOL_MAX || 5)),
    channel: sanitizeChannel(
      process.env.BRIDGE_NOTIFY_CHANNEL || 'agent_job_ready',
    ),
  };
}

function sanitizeChannel(name) {
  const c = String(name || 'agent_job_ready');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) {
    throw new Error(`Invalid BRIDGE_NOTIFY_CHANNEL: ${c}`);
  }
  return c;
}

module.exports = { loadConfig, required };
