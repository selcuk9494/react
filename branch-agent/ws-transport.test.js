'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTransport, resolveWsUrl } = require('./ws-transport');

test('default transport is http', () => {
  assert.equal(resolveTransport({}), 'http');
  assert.equal(resolveTransport({ transport: 'HTTP' }), 'http');
});

test('auto and ws transports', () => {
  assert.equal(resolveTransport({ transport: 'auto' }), 'auto');
  assert.equal(resolveTransport({ transport: 'websocket' }), 'ws');
});

test('resolveWsUrl trims trailing slash', () => {
  assert.equal(
    resolveWsUrl({ bridgeWsUrl: 'wss://example.com/ws/' }),
    'wss://example.com/ws',
  );
  assert.equal(resolveWsUrl({}), '');
});
