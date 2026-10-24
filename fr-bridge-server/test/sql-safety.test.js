'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isMutatingSql,
  isMutatingJob,
  AMBIGUOUS_WRITE_ERROR,
} = require('../src/sql-safety');

test('SELECT is not mutating', () => {
  assert.equal(isMutatingSql('SELECT * FROM ads_acik'), false);
  assert.equal(isMutatingSql('  /* c */ SELECT 1'), false);
});

test('UPDATE/INSERT are mutating', () => {
  assert.equal(isMutatingSql('UPDATE ads_acik SET x=1 WHERE id=$1'), true);
  assert.equal(isMutatingSql('INSERT INTO t(a) VALUES ($1)'), true);
});

test('BATCH with only SELECT is not mutating', () => {
  assert.equal(
    isMutatingJob({
      sql: '__BATCH__',
      params: [{ sql: 'SELECT 1', params: [] }, { sql: 'SELECT 2', params: [] }],
    }),
    false,
  );
});

test('BATCH with UPDATE is mutating', () => {
  assert.equal(
    isMutatingJob({
      sql: '__BATCH__',
      params: [
        { sql: 'SELECT 1', params: [] },
        { sql: 'UPDATE t SET a=1', params: [] },
      ],
    }),
    true,
  );
});

test('ambiguous constant stable', () => {
  assert.equal(AMBIGUOUS_WRITE_ERROR, 'ambiguous_write_needs_review');
});
