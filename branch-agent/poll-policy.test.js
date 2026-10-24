'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  IDLE_POLL_MS,
  BUSY_POLL_MS,
  ERR_BACKOFF_BASE_MS,
  ERR_BACKOFF_MAX_MS,
  nextDelayMs,
  createSingleFlight,
} = require('./poll-policy');

test('idle poll is 3 seconds', () => {
  assert.equal(IDLE_POLL_MS, 3000);
  assert.equal(nextDelayMs({ hadJobs: false, errorStreak: 0 }), 3000);
});

test('after jobs, re-poll immediately (no busy spin delay)', () => {
  assert.equal(BUSY_POLL_MS, 0);
  assert.equal(nextDelayMs({ hadJobs: true, errorStreak: 0 }), 0);
});

test('error backoff grows exponentially with jitter bounds', () => {
  const fixed = () => 0.5; // zero jitter
  assert.equal(nextDelayMs({ hadJobs: false, errorStreak: 1, random: fixed }), ERR_BACKOFF_BASE_MS);
  assert.equal(nextDelayMs({ hadJobs: false, errorStreak: 2, random: fixed }), ERR_BACKOFF_BASE_MS * 2);
  assert.equal(nextDelayMs({ hadJobs: false, errorStreak: 3, random: fixed }), ERR_BACKOFF_BASE_MS * 4);
  const capped = nextDelayMs({ hadJobs: false, errorStreak: 20, random: fixed });
  assert.equal(capped, ERR_BACKOFF_MAX_MS);
});

test('error backoff applies jitter within ±20%', () => {
  const low = nextDelayMs({ hadJobs: false, errorStreak: 1, random: () => 0 });
  const high = nextDelayMs({ hadJobs: false, errorStreak: 1, random: () => 1 });
  assert.ok(low >= 500);
  assert.ok(low <= ERR_BACKOFF_BASE_MS);
  assert.ok(high >= ERR_BACKOFF_BASE_MS);
  assert.ok(high <= ERR_BACKOFF_BASE_MS * 1.2 + 1);
});

test('hadJobs ignored while in error streak (backoff wins)', () => {
  const d = nextDelayMs({ hadJobs: true, errorStreak: 1, random: () => 0.5 });
  assert.equal(d, ERR_BACKOFF_BASE_MS);
});

test('single-flight blocks concurrent enter', () => {
  const flight = createSingleFlight();
  assert.equal(flight.tryEnter(), true);
  assert.equal(flight.isBusy, true);
  assert.equal(flight.tryEnter(), false);
  flight.leave();
  assert.equal(flight.tryEnter(), true);
  flight.leave();
});
