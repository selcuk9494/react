'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  resolvePgSsl,
  normalizeMode,
  buildPgConnectionConfig,
  sslMeta,
} = require('../src/pg-ssl');

const SAMPLE_CA = `-----BEGIN CERTIFICATE-----
MIIBsampleFAKEFORTESTONLY
-----END CERTIFICATE-----
`;

test('default / disable → no ssl', () => {
  assert.equal(normalizeMode(''), 'unset');
  assert.equal(resolvePgSsl({ env: {} }), false);
  assert.equal(resolvePgSsl({ env: { DB_SSL: 'disable' } }), false);
});

test('no-verify is rejected (not allowed)', () => {
  assert.throws(
    () => resolvePgSsl({ env: { DB_SSL: 'no-verify' } }),
    /not allowed/,
  );
  assert.throws(() => normalizeMode('insecure'), /not allowed/);
});

test('verify without CA keeps rejectUnauthorized true', () => {
  const ssl = resolvePgSsl({ env: { DB_SSL: 'require' } });
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, undefined);
  assert.equal(ssl._meta.expectFailureWithoutCa, true);
});

test('verify with DB_CA_CERT attaches ca', () => {
  const ssl = resolvePgSsl({
    env: { DB_SSL: 'require', DB_CA_CERT: SAMPLE_CA.replace(/\n/g, '\\n') },
  });
  assert.equal(ssl.rejectUnauthorized, true);
  assert.match(ssl.ca, /BEGIN CERTIFICATE/);
});

test('verify with DB_CA_CERT_PATH reads file', () => {
  const p = path.join(os.tmpdir(), `fr-bridge-ca-${process.pid}.pem`);
  fs.writeFileSync(p, SAMPLE_CA);
  try {
    const ssl = resolvePgSsl({
      env: { DB_SSL: 'verify-full', DB_CA_CERT_PATH: p },
    });
    assert.equal(ssl.rejectUnauthorized, true);
    assert.match(ssl.ca, /BEGIN CERTIFICATE/);
  } finally {
    fs.unlinkSync(p);
  }
});

test('buildPgConnectionConfig strips sslmode from URL', () => {
  const cfg = buildPgConnectionConfig({
    databaseUrl:
      'postgresql://u:p@aws-0-eu.pooler.supabase.com:5432/postgres?sslmode=require',
    ssl: { rejectUnauthorized: true, ca: SAMPLE_CA },
  });
  assert.equal(cfg.ssl.rejectUnauthorized, true);
  assert.equal(cfg.ssl.ca, SAMPLE_CA);
  assert.equal(String(cfg.connectionString).includes('sslmode='), false);
  assert.equal(cfg.ssl._meta, undefined);
});

test('sslMeta never exposes PEM', () => {
  const m = sslMeta({
    rejectUnauthorized: true,
    ca: SAMPLE_CA,
    _meta: { mode: 'verify', caSource: 'DB_CA_CERT|PATH' },
  });
  assert.equal(JSON.stringify(m).includes('BEGIN CERTIFICATE'), false);
});

test('Pool and LISTEN share same builder shape', () => {
  const ssl = resolvePgSsl({
    env: { DB_SSL: 'require', DB_CA_CERT: SAMPLE_CA },
  });
  const poolCfg = buildPgConnectionConfig({
    databaseUrl: 'postgresql://u:p@host:5432/db',
    ssl,
    poolExtras: { max: 5 },
  });
  const listenCfg = buildPgConnectionConfig({
    databaseUrl: 'postgresql://u:p@host:5432/db',
    ssl,
  });
  assert.equal(poolCfg.ssl.rejectUnauthorized, listenCfg.ssl.rejectUnauthorized);
  assert.equal(poolCfg.ssl.ca, listenCfg.ssl.ca);
  assert.equal(poolCfg.max, 5);
  assert.equal(listenCfg.max, undefined);
});
