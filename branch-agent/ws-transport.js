'use strict';

/**
 * FrRaporBridge → fr-bridge-server WSS istemcisi.
 * job-result / enroll / dashboard-snapshot hâlâ HTTP (cloudUrl / Vercel).
 */

function resolveWsUrl(cfg) {
  const raw = String(cfg.bridgeWsUrl || process.env.FR_BRIDGE_WS_URL || '').trim();
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

function resolveTransport(cfg) {
  const t = String(cfg.transport || process.env.FR_BRIDGE_TRANSPORT || 'http')
    .trim()
    .toLowerCase();
  if (t === 'ws' || t === 'websocket') return 'ws';
  if (t === 'auto') return 'auto';
  return 'http';
}

/**
 * @param {{
 *   wsUrl: string,
 *   agentId: string,
 *   secret: string,
 *   onJobs: (jobs: any[]) => Promise<void>,
 *   onSession: (session: any) => void,
 *   log: (line: string) => void,
 * }} opts
 */
function createWsBridge(opts) {
  let ws = null;
  let stopped = false;
  let reconnectTimer = null;
  let pingTimer = null;
  let reconnectAttempt = 0;
  let connected = false;
  /** @type {typeof import('ws') | null} */
  let WsCtor = null;

  function loadWs() {
    if (WsCtor) return WsCtor;
    try {
      WsCtor = require('ws');
      return WsCtor;
    } catch (err) {
      opts.log('ws paketi yok — HTTP poll kullanin: ' + (err.message || err));
      return null;
    }
  }

  function clearTimers() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearInterval(pingTimer);
    reconnectTimer = null;
    pingTimer = null;
  }

  function scheduleReconnect() {
    if (stopped) return;
    clearTimers();
    connected = false;
    const delay = Math.min(60_000, 1000 * Math.pow(2, Math.min(reconnectAttempt, 5)));
    reconnectAttempt += 1;
    opts.log(`ws yeniden baglanti ${delay}ms sonra (attempt=${reconnectAttempt})`);
    reconnectTimer = setTimeout(() => connect(), delay);
  }

  function handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const type = String(msg.type || '');
    if (type === 'auth.ok' || type === 'pong') {
      connected = true;
      reconnectAttempt = 0;
      opts.onSession(msg);
      return;
    }
    if (type === 'auth.err') {
      opts.log('ws auth hata: ' + (msg.error || 'auth'));
      try {
        ws?.close();
      } catch (_) {}
      return;
    }
    if (type === 'jobs') {
      const jobs = Array.isArray(msg.jobs) ? msg.jobs : [];
      void opts.onJobs(jobs).catch((err) => {
        opts.log('ws jobs isleme hata: ' + (err.message || err));
      });
      try {
        ws?.send(JSON.stringify({ type: 'jobs.ack' }));
      } catch (_) {}
      return;
    }
  }

  function connect() {
    if (stopped) return;
    const Ctor = loadWs();
    if (!Ctor) {
      scheduleReconnect();
      return;
    }
    clearTimers();
    try {
      if (ws) {
        try {
          ws.removeAllListeners?.();
          ws.close();
        } catch (_) {}
      }
    } catch (_) {}

    const url = opts.wsUrl.includes('/ws') ? opts.wsUrl : `${opts.wsUrl}/ws`;
    opts.log('ws baglaniyor: ' + url);
    ws = new Ctor(url);

    ws.on('open', () => {
      opts.log('ws acildi, auth gonderiliyor');
      try {
        ws.send(
          JSON.stringify({
            type: 'auth',
            agentId: opts.agentId,
            secret: opts.secret,
          }),
        );
      } catch (err) {
        opts.log('ws auth send hata: ' + (err.message || err));
      }
      pingTimer = setInterval(() => {
        if (!ws || ws.readyState !== 1) return;
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch (_) {}
      }, 20_000);
    });

    ws.on('message', handleMessage);
    ws.on('close', (code, reason) => {
      connected = false;
      opts.log(
        `ws kapandi code=${code} reason=${String(reason || '')}`,
      );
      scheduleReconnect();
    });
    ws.on('error', (err) => {
      opts.log('ws hata: ' + (err.message || err));
    });
  }

  return {
    start() {
      stopped = false;
      connect();
    },
    stop() {
      stopped = true;
      clearTimers();
      try {
        ws?.close();
      } catch (_) {}
      ws = null;
      connected = false;
    },
    isConnected() {
      return connected && ws && ws.readyState === 1;
    },
  };
}

module.exports = {
  resolveWsUrl,
  resolveTransport,
  createWsBridge,
};
