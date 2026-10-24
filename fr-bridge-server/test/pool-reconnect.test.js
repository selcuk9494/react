'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Pool limit + kopma sonrası yeniden deneme modeli (in-memory).
 */
function createLimitedPool(max) {
  let active = 0;
  let connects = 0;
  let fails = 0;
  return {
    get active() {
      return active;
    },
    get connects() {
      return connects;
    },
    get fails() {
      return fails;
    },
    async query(_sql, { failOnce = false } = {}) {
      if (active >= max) {
        fails++;
        throw new Error('pool_exhausted');
      }
      active++;
      connects++;
      try {
        if (failOnce && connects === 1) {
          const err = new Error('connection_lost');
          throw err;
        }
        await new Promise((r) => setTimeout(r, 5));
        return { rows: [{ ok: true }] };
      } finally {
        active--;
      }
    },
    async queryWithRetry(sql, opts = {}) {
      let last;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await this.query(sql, {
            failOnce: opts.failOnce && attempt === 1,
          });
        } catch (err) {
          last = err;
          if (String(err.message).includes('pool_exhausted')) throw err;
          await new Promise((r) => setTimeout(r, 10 * attempt));
        }
      }
      throw last;
    },
  };
}

test('pool max respected — excess fails', async () => {
  const pool = createLimitedPool(2);
  const running = [
    pool.query('a'),
    pool.query('b'),
    pool.query('c').catch((e) => e.message),
  ];
  const results = await Promise.all(running);
  assert.equal(results[2], 'pool_exhausted');
  assert.ok(pool.fails >= 1);
});

test('connection_lost then retry succeeds', async () => {
  const pool = createLimitedPool(5);
  const res = await pool.queryWithRetry('SELECT 1', { failOnce: true });
  assert.equal(res.rows[0].ok, true);
  assert.ok(pool.connects >= 2);
});
