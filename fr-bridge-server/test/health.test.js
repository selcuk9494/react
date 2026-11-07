'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateHealth } = require('../src/runtime-status');

test('postgres down is 503 even if LISTEN is up', () => {
  const v = evaluateHealth({
    postgresOk: false,
    listenWanted: true,
    phase: 'listening',
    withinStartupGrace: true,
    lastError: null,
  });
  assert.equal(v.ok, false);
  assert.equal(v.ready, false);
});

test('LISTEN down after startup is 503 and not ready', () => {
  const v = evaluateHealth({
    postgresOk: true,
    listenWanted: true,
    phase: 'reconnecting',
    withinStartupGrace: true,
    lastError: 'connection ended',
  });
  assert.equal(v.ok, false);
  assert.equal(v.ready, false);
});

test('first LISTEN connect inside grace is HTTP 200 but not cutover-ready', () => {
  const v = evaluateHealth({
    postgresOk: true,
    listenWanted: true,
    phase: 'connecting',
    withinStartupGrace: true,
    lastError: null,
  });
  assert.equal(v.ok, true);
  assert.equal(v.ready, false);
  assert.equal(v.starting, true);
});

test('connecting past grace is 503', () => {
  const v = evaluateHealth({
    postgresOk: true,
    listenWanted: true,
    phase: 'connecting',
    withinStartupGrace: false,
    lastError: null,
  });
  assert.equal(v.ok, false);
  assert.equal(v.ready, false);
});

test('listener not started yet inside grace is not the same as zero agents', () => {
  const starting = evaluateHealth({
    postgresOk: true,
    listenWanted: true,
    phase: 'not_started',
    withinStartupGrace: true,
    lastError: null,
  });
  const listeningNoAgents = evaluateHealth({
    postgresOk: true,
    listenWanted: true,
    phase: 'listening',
    withinStartupGrace: false,
    lastError: null,
  });
  assert.equal(starting.ok, true);
  assert.equal(starting.ready, false);
  assert.equal(listeningNoAgents.ok, true);
  assert.equal(listeningNoAgents.ready, true);
});

test('health ready only when postgres and LISTEN are both up', () => {
  const v = evaluateHealth({
    postgresOk: true,
    listenWanted: true,
    phase: 'listening',
    withinStartupGrace: false,
    lastError: null,
  });
  assert.equal(v.ok, true);
  assert.equal(v.ready, true);
});
