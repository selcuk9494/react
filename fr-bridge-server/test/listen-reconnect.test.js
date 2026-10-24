'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');

/**
 * Fake pg.Client: connect fail once then succeed; ensures new instance each time.
 */
function installFakePg(ClientFactory) {
  const { createListenManager } = require('../src/listen');
  // Override by injecting makeClientConfig that returns markers; we monkey via custom Client in module — instead test schedule + destroy path with stubbed Client.

  let constructed = 0;
  const clients = [];

  class FakeClient extends EventEmitter {
    constructor() {
      super();
      constructed += 1;
      this.id = constructed;
      this.connected = false;
      this.ended = false;
      clients.push(this);
    }
    async connect() {
      if (this.id === 1) {
        const err = new Error('connect ENETUNREACH [ipv6]');
        throw err;
      }
      this.connected = true;
    }
    async query(sql) {
      if (!this.connected) throw new Error('not connected');
      if (String(sql).startsWith('LISTEN')) return { rows: [] };
      return { rows: [] };
    }
    async end() {
      this.ended = true;
      this.connected = false;
    }
    destroy() {
      this.ended = true;
    }
  }

  // Patch require cache for pg used inside listen.js — create manager with injectable Client
  // We'll re-implement thin wrapper test against createListenManager by temporarily replacing Client.
  const listenPath = require.resolve('../src/listen');
  delete require.cache[listenPath];
  const pgPath = require.resolve('pg');
  const realPg = require('pg');
  const origClient = realPg.Client;
  realPg.Client = FakeClient;

  delete require.cache[listenPath];
  const { createListenManager: create } = require('../src/listen');

  return {
    create,
    clients: () => clients,
    constructed: () => constructed,
    restore() {
      realPg.Client = origClient;
      delete require.cache[listenPath];
    },
  };
}

test('LISTEN reconnect creates a new Client after failure (no reuse)', async () => {
  const fake = installFakePg();
  try {
    const logs = [];
    const mgr = fake.create({
      channel: 'agent_job_ready',
      makeClientConfig: () => ({}),
      baseBackoffMs: 20,
      maxBackoffMs: 50,
      log: (...a) => logs.push(a.join(' ')),
      onNotify() {},
    });
    mgr.start();
    await new Promise((r) => setTimeout(r, 120));
    assert.ok(fake.constructed() >= 2, 'expected at least 2 Client constructions');
    assert.equal(fake.clients()[0].ended, true, 'failed client cleaned up');
    assert.equal(mgr.getStatus().listening, true);
    await mgr.stop();
  } finally {
    fake.restore();
  }
});

test('failed Client is not reconnect()ed — new instance only', async () => {
  const fake = installFakePg();
  try {
    const mgr = fake.create({
      channel: 'agent_job_ready',
      makeClientConfig: () => ({}),
      baseBackoffMs: 15,
      maxBackoffMs: 40,
      log() {},
      onNotify() {},
    });
    mgr.start();
    await new Promise((r) => setTimeout(r, 100));
    const first = fake.clients()[0];
    const second = fake.clients()[1];
    assert.notEqual(first, second);
    assert.notEqual(first.id, second.id);
    await mgr.stop();
  } finally {
    fake.restore();
  }
});
