'use strict';

const { Client } = require('pg');
const { redactErrorMessage } = require('./db-url-meta');

/**
 * LISTEN yöneticisi: her denemede yeni Client; başarısız client yeniden kullanılmaz.
 */
function queryWithTimeout(client, text, timeoutMs) {
  let timer;
  return Promise.race([
    client.query(text),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('LISTEN query timeout')), timeoutMs);
      timer.unref?.();
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function createListenManager(opts) {
  const {
    channel,
    makeClientConfig,
    onNotify,
    log = console.log,
    maxBackoffMs = 60_000,
    baseBackoffMs = 1000,
    queryTimeoutMs = 8_000,
  } = opts;

  let stopped = false;
  let client = null;
  let reconnectTimer = null;
  let attempt = 0;
  let status = {
    listening: false,
    phase: 'not_started',
    lastError: null,
    lastConnectedAt: null,
    lastNotifyAt: null,
    attempts: 0,
  };

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  async function destroyClient(c) {
    if (!c) return;
    try {
      c.removeAllListeners();
    } catch (_) {}
    try {
      await c.end();
    } catch (_) {
      try {
        c.destroy?.();
      } catch (_) {}
    }
  }

  function scheduleReconnect(reason) {
    if (stopped) return;
    clearReconnectTimer();
    status.listening = false;
    status.phase = 'reconnecting';
    status.lastError = redactErrorMessage(reason);
    attempt += 1;
    status.attempts = attempt;
    const wait = Math.min(
      maxBackoffMs,
      baseBackoffMs * Math.pow(2, Math.min(attempt - 1, 6)),
    );
    log(
      'LISTEN reconnect scheduled',
      `attempt=${attempt}`,
      `backoffMs=${wait}`,
      `reason=${status.lastError}`,
    );
    reconnectTimer = setTimeout(() => {
      void connectLoop();
    }, wait);
    reconnectTimer.unref?.();
  }

  async function connectLoop() {
    if (stopped) return;
    clearReconnectTimer();

    const prev = client;
    client = null;
    status.listening = false;
    status.phase = 'connecting';
    await destroyClient(prev);

    const next = new Client(makeClientConfig());
    client = next;
    status.attempts = attempt + 1;

    try {
      await next.connect();
      await queryWithTimeout(next, `LISTEN ${channel}`, queryTimeoutMs);
      attempt = 0;
      status.attempts = 0;
      status.listening = true;
      status.phase = 'listening';
      status.lastError = null;
      status.lastConnectedAt = new Date().toISOString();
      log('LISTEN active', channel);

      next.on('notification', (msg) => {
        if (msg.channel !== channel) return;
        status.lastNotifyAt = new Date().toISOString();
        try {
          onNotify(msg);
        } catch (err) {
          log('LISTEN notify handler error', redactErrorMessage(err.message || err));
        }
      });

      next.on('error', (err) => {
        log('LISTEN client error', redactErrorMessage(err.message || err));
        if (client === next) {
          scheduleReconnect(err.message || err);
        }
      });

      next.on('end', () => {
        if (stopped) return;
        if (client === next) {
          scheduleReconnect('connection ended');
        }
      });
    } catch (err) {
      const msg = redactErrorMessage(err.message || err);
      log('LISTEN connect failed', msg);
      await destroyClient(next);
      if (client === next) client = null;
      scheduleReconnect(msg);
    }
  }

  return {
    start() {
      stopped = false;
      attempt = 0;
      void connectLoop();
    },
    async stop() {
      stopped = true;
      clearReconnectTimer();
      status.listening = false;
      status.phase = 'not_started';
      const c = client;
      client = null;
      await destroyClient(c);
    },
    getStatus() {
      return { ...status, channel };
    },
    /** Test: force schedule without live PG */
    _scheduleReconnectForTest(reason) {
      scheduleReconnect(reason);
    },
  };
}

module.exports = { createListenManager };
