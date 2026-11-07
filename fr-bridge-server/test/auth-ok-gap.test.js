'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sessionPayload } = require('../src/jobs');

const indexSrc = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');

function onAuthBody() {
  const start = indexSrc.indexOf('async function onAuth');
  const end = indexSrc.indexOf('async function onPing');
  assert.ok(start > 0 && end > start);
  return indexSrc.slice(start, end);
}

test('auth.ok is only reached after sessionPayload resolves', () => {
  const body = onAuthBody();
  const setId = body.indexOf('ws.agentId = agentId');
  const wait = body.indexOf('await sessionPayload(pool, agent)');
  const sendOk = body.indexOf("sendAuthOk(ws, { type: 'auth.ok'");
  assert.ok(setId > 0);
  assert.ok(wait > setId);
  assert.ok(sendOk > wait);
});

test('send drops auth.ok when the socket is no longer open', () => {
  const sendFn = indexSrc.slice(indexSrc.indexOf('function send('), indexSrc.indexOf('async function pushJobs'));
  assert.match(sendFn, /if \(ws\.readyState !== 1\) return;/);
  const sent = [];
  function send(ws, payload) {
    if (ws.readyState !== 1) return;
    try {
      sent.push(JSON.parse(JSON.stringify(payload)));
    } catch (_) {}
  }
  const ws = { readyState: 1, agentId: '' };
  ws.agentId = '38dc3ad9-13c7-45a0-a7d3-86dc4948093e';
  ws.readyState = 3;
  send(ws, { type: 'auth.ok', paired: true, pairCode: null, snapshot: null });
  assert.equal(ws.agentId, '38dc3ad9-13c7-45a0-a7d3-86dc4948093e');
  assert.equal(sent.length, 0);
});

test('sessionPayload has no timeout and blocks the auth.ok line', async () => {
  const pool = {
    query() {
      return new Promise(() => {});
    },
  };
  let sent = false;
  const ws = { agentId: '', readyState: 1 };
  ws.agentId = '38dc3ad9-13c7-45a0-a7d3-86dc4948093e';
  const pending = sessionPayload(pool, {
    id: ws.agentId,
    status: 'paired',
    branch_id: 151,
  }).then((session) => {
    sent = true;
    return session;
  });
  const winner = await Promise.race([
    pending.then(() => 'resolved'),
    new Promise((resolve) => setTimeout(() => resolve('still-waiting'), 40)),
  ]);
  assert.equal(winner, 'still-waiting');
  assert.equal(sent, false);
  assert.ok(ws.agentId);
});

test('a resolved sessionPayload is the auth.ok body the client accepts', async () => {
  const queries = [];
  const pool = {
    async query(sql) {
      queries.push(String(sql));
      if (String(sql).includes('branch_kasas')) return { rows: [{ kasa_no: 1 }] };
      if (String(sql).includes('FROM branches')) return { rows: [{ kasa_no: 1, closing_hour: 6 }] };
      return { rows: [] };
    },
  };
  const session = await sessionPayload(pool, {
    id: '38dc3ad9-13c7-45a0-a7d3-86dc4948093e',
    status: 'paired',
    branch_id: 151,
  });
  const frame = { type: 'auth.ok', ...session };
  assert.equal(frame.type, 'auth.ok');
  assert.equal(frame.paired, true);
  assert.equal(frame.pairCode, null);
  assert.equal(frame.snapshot.branchId, 151);
  assert.deepEqual(queries.map((sql) => /UPDATE|branch_kasas|FROM branches/.exec(sql)[0]), [
    'UPDATE',
    'branch_kasas',
    'FROM branches',
  ]);
});
