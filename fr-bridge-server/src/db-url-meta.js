'use strict';

/**
 * DATABASE_URL sınıflandırması — host/şifre loglanmaz.
 * Render IPv4-only; Supabase direct genelde IPv6 → ENETUNREACH riski.
 */

function redactErrorMessage(msg) {
  return String(msg || '')
    .replace(/postgresql:\/\/[^\s]+/gi, 'postgresql://***')
    .replace(/postgres:\/\/[^\s]+/gi, 'postgres://***')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ipv4]')
    .replace(/\b[0-9a-f:]{10,}\b/gi, '[ipv6]');
}

/**
 * @param {string|null|undefined} databaseUrl
 * @param {{ host?: string, port?: number }|null} dbParts
 */
function classifyDatabaseTarget(databaseUrl, dbParts = null) {
  let host = '';
  let port = 0;
  let user = '';

  if (databaseUrl) {
    try {
      const u = new URL(databaseUrl);
      host = (u.hostname || '').toLowerCase();
      port = Number(u.port) || 5432;
      user = decodeURIComponent(u.username || '');
    } catch {
      return {
        kind: 'unparseable',
        listenOk: false,
        ipv4Hint: 'unknown',
        advice: 'DATABASE_URL parse edilemedi',
      };
    }
  } else if (dbParts?.host) {
    host = String(dbParts.host).toLowerCase();
    port = Number(dbParts.port) || 5432;
  } else {
    return {
      kind: 'missing',
      listenOk: false,
      ipv4Hint: 'unknown',
      advice: 'DATABASE_URL yok',
    };
  }

  const isSupabaseDirect =
    /^db\.[a-z0-9-]+\.supabase\.co$/i.test(host) ||
    (host.startsWith('db.') && host.endsWith('.supabase.co'));
  const isSupabasePooler = host.includes('pooler.supabase.com');
  const isTransactionPort = port === 6543;

  if (isSupabaseDirect) {
    return {
      kind: 'supabase_direct',
      listenOk: true, // protokol destekler; ağ IPv6 olabilir
      ipv4Hint: 'likely_ipv6_only',
      advice:
        'Render IPv4-only. Supabase Dashboard → Connect → Session pooler (port 5432, host *.pooler.supabase.com). Transaction pooler (6543) LISTEN için kullanma. İsteğe bağlı: IPv4 add-on.',
    };
  }

  if (isSupabasePooler && isTransactionPort) {
    return {
      kind: 'supabase_transaction_pooler',
      listenOk: false,
      ipv4Hint: 'ipv4',
      advice:
        'Transaction pooler (6543) LISTEN/NOTIFY desteklemez. Session pooler port 5432 kullan.',
    };
  }

  if (isSupabasePooler) {
    return {
      kind: 'supabase_session_pooler',
      listenOk: true,
      ipv4Hint: 'ipv4',
      advice: 'Session pooler — LISTEN için uygun (IPv4).',
      userLooksShared: /\./.test(user), // postgres.PROJECTREF
    };
  }

  return {
    kind: 'other',
    listenOk: true,
    ipv4Hint: 'unknown',
    advice: 'Host sınıflandırması genel; ENETUNREACH IPv6 ise IPv4 endpoint kullan.',
  };
}

module.exports = {
  classifyDatabaseTarget,
  redactErrorMessage,
};
