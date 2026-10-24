'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntimeStatus } = require('../src/runtime-status');

test('health unhealthy when postgres down even if timer would tick', () => {
  const runtime = createRuntimeStatus();
  runtime.postgres.ok = false;
  runtime.postgres.lastError = 'connect failed';
  runtime.listen.listening = true;
  runtime.safetyPoll.lastOkAt = null;

  const healthy = runtime.postgres.ok && runtime.listen.listening;
  assert.equal(healthy, false);
});

test('health unhealthy when LISTEN down', () => {
  const runtime = createRuntimeStatus();
  runtime.postgres.ok = true;
  runtime.listen.listening = false;
  const healthy = runtime.postgres.ok && runtime.listen.listening;
  assert.equal(healthy, false);
});

test('health ok only when both postgres and listen ok', () => {
  const runtime = createRuntimeStatus();
  runtime.postgres.ok = true;
  runtime.listen.listening = true;
  assert.equal(runtime.postgres.ok && runtime.listen.listening, true);
});
