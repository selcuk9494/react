'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyDatabaseTarget,
  redactErrorMessage,
} = require('../src/db-url-meta');

test('supabase direct → likely IPv6, session pooler advice', () => {
  const c = classifyDatabaseTarget(
    'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres',
  );
  assert.equal(c.kind, 'supabase_direct');
  assert.equal(c.ipv4Hint, 'likely_ipv6_only');
  assert.match(c.advice, /Session pooler/i);
});

test('supabase session pooler port 5432 → listen ok ipv4', () => {
  const c = classifyDatabaseTarget(
    'postgresql://postgres.abc:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
  );
  assert.equal(c.kind, 'supabase_session_pooler');
  assert.equal(c.listenOk, true);
  assert.equal(c.ipv4Hint, 'ipv4');
});

test('supabase transaction pooler 6543 → listen NOT ok', () => {
  const c = classifyDatabaseTarget(
    'postgresql://postgres.abc:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
  );
  assert.equal(c.kind, 'supabase_transaction_pooler');
  assert.equal(c.listenOk, false);
  assert.match(c.advice, /6543|Transaction/i);
});

test('redactErrorMessage strips URLs and IPv6', () => {
  const raw =
    'connect ENETUNREACH 2606:4700:3030::6815:4a2e postgresql://u:p@db.x.supabase.co/postgres';
  const r = redactErrorMessage(raw);
  assert.equal(r.includes('2606:'), false);
  assert.equal(r.includes('postgresql://u:p'), false);
  assert.match(r, /ENETUNREACH/);
});
