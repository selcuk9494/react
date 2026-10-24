'use strict';

/**
 * PostgreSQL TLS ayarı — güvenli varsayılan.
 *
 * DB_SSL / PGSSLMODE:
 *   unset / disable / false → SSL yok (yalnızca güvenilir private network)
 *   require / true / verify-full → SSL + rejectUnauthorized: true (varsayılan güvenli)
 *   no-verify / insecure → SSL + rejectUnauthorized: false (AÇIKÇA istenmeli; log uyarısı)
 *
 * Not: Host adında "render.com" geçmesi tek başına insecure SSL açmaz.
 */

function normalizeMode(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (!v || v === 'disable' || v === 'false' || v === '0' || v === 'off') {
    return 'disable';
  }
  if (
    v === 'no-verify' ||
    v === 'insecure' ||
    v === 'allow' ||
    v === 'prefer-insecure'
  ) {
    return 'no-verify';
  }
  // require, verify-ca, verify-full, true, 1, on
  return 'verify';
}

/**
 * @param {{ databaseUrl?: string|null, host?: string, env?: NodeJS.ProcessEnv }} opts
 * @returns {false | { rejectUnauthorized: boolean }}
 */
function resolvePgSsl(opts = {}) {
  const env = opts.env || process.env;
  const mode = normalizeMode(env.DB_SSL || env.PGSSLMODE || env.BRIDGE_PG_SSL);

  if (mode === 'disable') {
    // URL'de sslmode=require varsa pg sürücüsü yine SSL deneyebilir; açık disable için false.
    return false;
  }
  if (mode === 'no-verify') {
    console.warn(
      '[fr-bridge-server] WARNING: DB_SSL/PGSSLMODE=no-verify — TLS cert doğrulaması KAPALI',
    );
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

module.exports = { resolvePgSsl, normalizeMode };
