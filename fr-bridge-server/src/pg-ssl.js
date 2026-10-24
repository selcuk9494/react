'use strict';

const fs = require('fs');

/**
 * PostgreSQL TLS — doğrulama her zaman açık (rejectUnauthorized: false yok).
 *
 * DB_SSL / PGSSLMODE / BRIDGE_PG_SSL:
 *   disable → SSL yok
 *   require | verify-ca | verify-full | true | (boş+URL) → SSL + rejectUnauthorized: true
 *
 * CA kaynakları (öncelik):
 *   1. DB_CA_CERT / BRIDGE_DB_CA_CERT
 *   2. DB_CA_CERT_PATH / BRIDGE_DB_CA_CERT_PATH
 *   3. NODE_EXTRA_CA_CERTS (Node trust store)
 *
 * DATABASE_URL sslmode query param strip edilir (pg override çakışmasını önler).
 * PEM / URL / secret loglanmaz.
 */

function normalizeMode(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'disable' || v === 'false' || v === '0' || v === 'off') {
    return 'disable';
  }
  if (
    v === 'no-verify' ||
    v === 'insecure' ||
    v === 'allow' ||
    v === 'prefer-insecure'
  ) {
    throw new Error(
      'DB_SSL=no-verify/insecure is not allowed. Set DB_CA_CERT (Supabase CA) with DB_SSL=require.',
    );
  }
  // empty, require, verify-*, true, on → verify when SSL wanted
  if (!v) return 'unset';
  return 'verify';
}

function loadCaPem(env = process.env) {
  const inline = env.DB_CA_CERT || env.BRIDGE_DB_CA_CERT || '';
  if (inline.trim()) {
    return inline.replace(/\\n/g, '\n').trim() + '\n';
  }
  const certPath = env.DB_CA_CERT_PATH || env.BRIDGE_DB_CA_CERT_PATH || '';
  if (certPath.trim()) {
    return fs.readFileSync(certPath.trim(), 'utf8');
  }
  return null;
}

function hasNodeExtraCa(env = process.env) {
  const p = String(env.NODE_EXTRA_CA_CERTS || '').trim();
  if (!p) return false;
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * @returns {false | { rejectUnauthorized: true, ca?: string, _meta?: object }}
 */
function resolvePgSsl(opts = {}) {
  const env = opts.env || process.env;
  const mode = normalizeMode(env.DB_SSL || env.PGSSLMODE || env.BRIDGE_PG_SSL);

  if (mode === 'disable') {
    return false;
  }

  // unset: SSL only if explicitly require/verify via env; default for bridge on Render is DB_SSL=require
  if (mode === 'unset') {
    return false;
  }

  const ca = loadCaPem(env);
  const extraCa = hasNodeExtraCa(env);

  if (ca) {
    return {
      rejectUnauthorized: true,
      ca,
      _meta: { mode: 'verify', caSource: 'DB_CA_CERT|PATH' },
    };
  }
  if (extraCa) {
    return {
      rejectUnauthorized: true,
      _meta: { mode: 'verify', caSource: 'NODE_EXTRA_CA_CERTS' },
    };
  }

  console.warn(
    '[fr-bridge-server] WARNING: DB_SSL=require/verify but no DB_CA_CERT / DB_CA_CERT_PATH / NODE_EXTRA_CA_CERTS. Supabase needs project CA. TLS verification stays ON.',
  );
  return {
    rejectUnauthorized: true,
    _meta: { mode: 'verify', caSource: 'none', expectFailureWithoutCa: true },
  };
}

function sslMeta(ssl) {
  if (ssl === false) return { ssl: false };
  if (!ssl || typeof ssl !== 'object') return { ssl: 'unknown' };
  return {
    rejectUnauthorized: true,
    caSource: ssl._meta?.caSource || (ssl.ca ? 'inline' : 'default-store'),
    mode: ssl._meta?.mode || 'verify',
  };
}

function buildPgConnectionConfig({ databaseUrl, dbParts, ssl, poolExtras = {} }) {
  const cleanSsl =
    ssl && typeof ssl === 'object'
      ? (() => {
          const { _meta, ...rest } = ssl;
          return rest;
        })()
      : ssl;

  if (databaseUrl) {
    let url = String(databaseUrl);
    try {
      const u = new URL(url);
      u.searchParams.delete('sslmode');
      u.searchParams.delete('sslrootcert');
      u.searchParams.delete('sslcert');
      u.searchParams.delete('sslkey');
      url = u.toString();
    } catch {
      // leave as-is
    }
    const cfg = {
      connectionString: url,
      connectionTimeoutMillis: 8_000,
      ...poolExtras,
    };
    if (cleanSsl !== undefined && cleanSsl !== null) {
      cfg.ssl = cleanSsl;
    }
    return cfg;
  }

  return {
    ...dbParts,
    ssl: cleanSsl,
    connectionTimeoutMillis: 8_000,
    ...poolExtras,
  };
}

module.exports = {
  resolvePgSsl,
  normalizeMode,
  loadCaPem,
  hasNodeExtraCa,
  sslMeta,
  buildPgConnectionConfig,
};
