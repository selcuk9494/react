'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendAuthOk, BRANCH_151_AGENT_ID } = require('../src/auth-diag');

const frame = { type: 'auth.ok', paired: true, pairCode: null, snapshot: null };

test('branch 151 records drop, attempt, callback ok and callback error', () => {
  const dropped = [];
  sendAuthOk(
    { agentId: BRANCH_151_AGENT_ID, readyState: 3, send() {} },
    frame,
    (line) => dropped.push(line),
  );
  assert.deepEqual(dropped, ['diag151 auth.ok dropped']);

  const ok = [];
  let okBody = '';
  sendAuthOk(
    {
      agentId: BRANCH_151_AGENT_ID,
      readyState: 1,
      send(body, cb) {
        okBody = body;
        cb();
      },
    },
    frame,
    (line) => ok.push(line),
  );
  assert.equal(JSON.parse(okBody).type, 'auth.ok');
  assert.deepEqual(ok, ['diag151 auth.ok send attempted', 'diag151 auth.ok send ok']);

  const failed = [];
  sendAuthOk(
    {
      agentId: BRANCH_151_AGENT_ID,
      readyState: 1,
      send(_body, cb) {
        cb(new Error('postgres://secret-host/db'));
      },
    },
    frame,
    (line) => failed.push(line),
  );
  assert.deepEqual(failed, ['diag151 auth.ok send attempted', 'diag151 auth.ok send error']);
  assert.equal(failed.join(' ').includes('secret-host'), false);
});

test('other agents send the same frame without diagnostic lines', () => {
  let sent = '';
  let logged = false;
  sendAuthOk(
    {
      agentId: 'other-agent',
      readyState: 1,
      send(body) {
        sent = body;
      },
    },
    frame,
    () => {
      logged = true;
    },
  );
  assert.equal(JSON.parse(sent).type, 'auth.ok');
  assert.equal(JSON.parse(sent).paired, true);
  assert.equal(logged, false);
});

test('synchronous send failure is recorded without the error text', () => {
  const lines = [];
  sendAuthOk(
    {
      agentId: BRANCH_151_AGENT_ID,
      readyState: 1,
      send() {
        throw new Error('ECONNRESET 10.1.1.1');
      },
    },
    frame,
    (line) => lines.push(line),
  );
  assert.deepEqual(lines, ['diag151 auth.ok send attempted', 'diag151 auth.ok send error']);
  assert.equal(lines.join(' ').includes('10.1.1.1'), false);
});
