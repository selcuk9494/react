'use strict';

/**
 * Lokal 50 eşzamanlı WSS yük testi (BRIDGE_TEST_MODE=1).
 * Production / ücretli Render oluşturmaz.
 *
 * Kullanım:
 *   node scripts/load-50.js
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const PORT = Number(process.env.LOAD_TEST_PORT || 18080);
const N = Math.min(50, Number(process.env.LOAD_TEST_N || 50));
const SECRET = 'load-test-secret';

function memMb() {
  const m = process.memoryUsage();
  return {
    rss: +(m.rss / 1024 / 1024).toFixed(2),
    heap: +(m.heapUsed / 1024 / 1024).toFixed(2),
  };
}

function cpuSnapshot() {
  const c = process.cpuUsage();
  return { userUs: c.user, systemUs: c.system };
}

async function waitHealth(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) return res.json();
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server health timeout');
}

function connectOne(i) {
  return new Promise((resolve) => {
    const started = Date.now();
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    let authed = false;
    const fail = (result) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_) {}
      resolve(result);
    };
    const timer = setTimeout(
      () => fail({ ok: false, error: 'timeout', i }),
      10_000,
    );
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'auth',
          agentId: `load-test-${i}`,
          secret: SECRET,
        }),
      );
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'auth.ok') {
          authed = true;
          clearTimeout(timer);
          resolve({ ok: true, i, ms: Date.now() - started, hold: ws });
        } else if (msg.type === 'auth.err') {
          fail({ ok: false, i, error: msg.error });
        }
      } catch (err) {
        fail({ ok: false, i, error: String(err.message || err) });
      }
    });
    ws.on('error', (err) => {
      if (authed) return;
      fail({ ok: false, i, error: err.message || String(err) });
    });
  });
}

async function main() {
  const serverPath = path.join(__dirname, '..', 'src', 'index.js');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      BRIDGE_TEST_MODE: '1',
      PORT: String(PORT),
      BRIDGE_MAX_AGENTS: '50',
      BRIDGE_SAFETY_POLL_MS: '5000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverLog = '';
  child.stdout.on('data', (d) => {
    serverLog += d.toString();
  });
  child.stderr.on('data', (d) => {
    serverLog += d.toString();
  });

  const cpu0 = cpuSnapshot();
  const mem0 = memMb();
  const wall0 = Date.now();

  try {
    const health = await waitHealth();
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => connectOne(i)),
    );
    // Bağlantıları ~1.5s tut (eşzamanlılık ölçümü)
    await new Promise((r) => setTimeout(r, 1500));

    let health2 = {};
    try {
      health2 = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
    } catch (_) {}

    const ok = results.filter((r) => r.ok);
    const fail = results.filter((r) => !r.ok);
    const cpu1 = cpuSnapshot();
    const mem1 = memMb();
    const wallMs = Date.now() - wall0;
    const cpuMs =
      (cpu1.userUs - cpu0.userUs + (cpu1.systemUs - cpu0.systemUs)) / 1000;

    // Tutulan soketleri kapat
    for (const r of ok) {
      try {
        r.hold?.close();
      } catch (_) {}
    }

    const report = {
      test: 'fr-bridge-server load-50',
      host: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      node: process.version,
      cpus: os.cpus().length,
      targetConnections: N,
      authenticatedOk: ok.length,
      failed: fail.length,
      errorRate: +((fail.length / N) * 100).toFixed(2),
      serverAgentsReported: health2.agents ?? health.agents,
      latencyMs: {
        min: ok.length ? Math.min(...ok.map((r) => r.ms)) : null,
        max: ok.length ? Math.max(...ok.map((r) => r.ms)) : null,
        avg: ok.length
          ? +(ok.reduce((s, r) => s + r.ms, 0) / ok.length).toFixed(1)
          : null,
      },
      clientProcess: {
        memRssMbBefore: mem0.rss,
        memRssMbAfter: mem1.rss,
        memHeapMbAfter: mem1.heap,
        cpuTimeMsApprox: +cpuMs.toFixed(1),
        wallMs,
      },
      failuresSample: fail.slice(0, 5),
      note: 'BRIDGE_TEST_MODE mock auth; PG yok. Render Starter üretimi değil.',
    };

    console.log(JSON.stringify(report, null, 2));
    if (fail.length) process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    try {
      child.kill('SIGKILL');
    } catch (_) {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
