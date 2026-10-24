'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createConnectionRegistry } = require('../src/connections');

function fakeWs(id) {
  return {
    id,
    readyState: 1,
    closed: null,
    sent: [],
    send(data) {
      this.sent.push(data);
    },
    close(code, reason) {
      this.closed = { code, reason };
      this.readyState = 3;
    },
  };
}

test('single active socket per agentId — previous closed', () => {
  const reg = createConnectionRegistry(50);
  const a1 = fakeWs('a1');
  const a2 = fakeWs('a2');
  assert.equal(reg.set('agent-1', a1).ok, true);
  assert.equal(reg.set('agent-1', a2).ok, true);
  assert.equal(a1.closed?.code, 4000);
  assert.equal(reg.get('agent-1').ws, a2);
  assert.equal(reg.size(), 1);
});

test('max agents enforced for new ids', () => {
  const reg = createConnectionRegistry(2);
  assert.equal(reg.set('a', fakeWs(1)).ok, true);
  assert.equal(reg.set('b', fakeWs(2)).ok, true);
  const r = reg.set('c', fakeWs(3));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'max_agents');
  // replace existing still ok
  assert.equal(reg.set('a', fakeWs(4)).ok, true);
});

test('send JSON to connected agent', () => {
  const reg = createConnectionRegistry(10);
  const ws = fakeWs(1);
  reg.set('x', ws);
  assert.equal(reg.send('x', { type: 'jobs', jobs: [] }), true);
  assert.equal(JSON.parse(ws.sent[0]).type, 'jobs');
  assert.equal(reg.send('missing', { type: 'jobs' }), false);
});
