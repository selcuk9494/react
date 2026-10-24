'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isMutatingSql, isMutatingJob } = require('./sql-safety');
const { resolveTransport } = require('./ws-transport');

test('default transport remains http for old agents', () => {
  assert.equal(resolveTransport({}), 'http');
  assert.equal(resolveTransport({ transport: undefined }), 'http');
});

test('write detection matches bridge-server policy', () => {
  assert.equal(isMutatingSql('SELECT 1'), false);
  assert.equal(isMutatingSql('UPDATE t SET a=$1'), true);
  assert.equal(
    isMutatingJob({
      sql: '__BATCH__',
      params: [{ sql: 'SELECT 1' }, { sql: 'DELETE FROM t' }],
    }),
    true,
  );
});
