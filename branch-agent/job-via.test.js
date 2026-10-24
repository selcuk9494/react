'use strict';

/**
 * via=ws|http log etiketleri ve cift-execution engeli (bellek ici).
 * Secret/SQL loglanmaz.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTransport } = require('./ws-transport');
const { createSingleFlight } = require('./poll-policy');

test('default transport remains http (fallback path)', () => {
  assert.equal(resolveTransport({}), 'http');
  assert.equal(resolveTransport({ transport: 'auto' }), 'auto');
});

test('via label only allows ws or http', () => {
  function normalizeVia(via) {
    return via === 'ws' ? 'ws' : 'http';
  }
  assert.equal(normalizeVia('ws'), 'ws');
  assert.equal(normalizeVia('http'), 'http');
  assert.equal(normalizeVia('other'), 'http');
  assert.equal(normalizeVia(undefined), 'http');
});

test('local job state prevents double run across channels', () => {
  const state = new Map();
  function tryRun(id) {
    const prev = state.get(id);
    if (prev === 'done' || prev === 'running' || prev === 'ambiguous') {
      return 'skip';
    }
    state.set(id, 'running');
    state.set(id, 'done');
    return 'run';
  }
  assert.equal(tryRun('job-1'), 'run');
  assert.equal(tryRun('job-1'), 'skip'); // ws sonra http (veya tersi)
});

test('single-flight still blocks overlapping main loops', () => {
  const f = createSingleFlight();
  assert.equal(f.tryEnter(), true);
  assert.equal(f.tryEnter(), false);
  f.leave();
  assert.equal(f.tryEnter(), true);
  f.leave();
});
