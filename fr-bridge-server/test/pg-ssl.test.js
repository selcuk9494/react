'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePgSsl, normalizeMode } = require('../src/pg-ssl');

test('default / disable → no ssl object forcing insecure', () => {
  assert.equal(normalizeMode(''), 'disable');
  assert.equal(resolvePgSsl({ env: {} }), false);
  assert.equal(resolvePgSsl({ env: { DB_SSL: 'disable' } }), false);
});

test('verify modes use rejectUnauthorized true (secure default when SSL on)', () => {
  assert.deepEqual(resolvePgSsl({ env: { DB_SSL: 'true' } }), {
    rejectUnauthorized: true,
  });
  assert.deepEqual(resolvePgSsl({ env: { PGSSLMODE: 'require' } }), {
    rejectUnauthorized: true,
  });
  assert.deepEqual(resolvePgSsl({ env: { PGSSLMODE: 'verify-full' } }), {
    rejectUnauthorized: true,
  });
});

test('no-verify is explicit opt-in only', () => {
  assert.deepEqual(resolvePgSsl({ env: { DB_SSL: 'no-verify' } }), {
    rejectUnauthorized: false,
  });
  assert.deepEqual(resolvePgSsl({ env: { PGSSLMODE: 'insecure' } }), {
    rejectUnauthorized: false,
  });
});

test('render.com hostname alone does not force insecure ssl', () => {
  assert.equal(
    resolvePgSsl({
      databaseUrl: 'postgres://u:p@dpg-xxx.frankfurt-postgres.render.com/db',
      env: {},
    }),
    false,
  );
});
