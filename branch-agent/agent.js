'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR =
  process.env.FR_RAPOR_DATA ||
  path.join(process.env.ProgramData || process.env.HOME || '.', 'FrRaporBridge');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const CODE_PATH = path.join(DATA_DIR, 'PAIR-CODE.txt');
const LOG_PATH = path.join(DATA_DIR, 'bridge.log');

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LOG_PATH, text);
  } catch (_) {}
  try {
    process.stdout.write(text);
  } catch (_) {}
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function writePairCode(code) {
  const body =
    `FR Rapor esleme kodu (TEK SEFERLIK)\n\n${code}\n\n` +
    `FR Rapor > Admin > Subeler > Yeni Sube > "Kod ile bagla"\n` +
    `veya Sube Ekle > Kod ile bagla alanina yazin.\n\n` +
    `ONEMLI:\n` +
    `- Bu kod sadece ILK esleme icindir (45 dk).\n` +
    `- Bir kez bagladiktan sonra baglanti KALICIDIR.\n` +
    `- Servis (FrRaporBridge) arka planda calisir; tekrar kod gerekmez.\n` +
    `- Kod suresi dolarse servisi yeniden baslatin, yeni kod uretilir.\n`;
  fs.writeFileSync(CODE_PATH, body);
  try {
    const desktop = path.join(os.homedir(), 'Desktop', 'FR-RAPOR-KOD.txt');
    fs.writeFileSync(desktop, body);
  } catch (_) {}
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

function makePool(cfg) {
  return new Pool({
    host: cfg.pgHost || '127.0.0.1',
    port: Number(cfg.pgPort || 5432),
    database: cfg.pgDatabase || 'fastrest',
    user: cfg.pgUser || 'begum',
    password: String(cfg.pgPassword || ''),
    max: 4,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 4000,
    statement_timeout: 20000,
  });
}

let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('uncaughtException', (err) => {
  log('uncaught ' + (err && err.stack ? err.stack : err));
});
process.on('unhandledRejection', (err) => {
  log('unhandled ' + (err && err.stack ? err.stack : err));
});

async function ensureEnrolled(cfg) {
  if (cfg.agentId && cfg.secret) return cfg;
  const cloud = (cfg.cloudUrl || 'https://react-delta-bice-16.vercel.app').replace(/\/$/, '');
  const enrolled = await postJson(`${cloud}/api/agent/enroll`, {
    machineName: os.hostname(),
  });
  const next = {
    ...cfg,
    agentId: enrolled.agentId,
    secret: enrolled.secret,
    pairCode: enrolled.pairCode,
  };
  writeConfig(next);
  writePairCode(enrolled.pairCode);
  log('esleme kodu: ' + enrolled.pairCode);
  return next;
}

async function mainLoop() {
  let cfg = Object.assign(
    {
      cloudUrl: 'https://react-delta-bice-16.vercel.app',
      pgHost: '127.0.0.1',
      pgPort: 5432,
      pgDatabase: 'fastrest',
      pgUser: 'begum',
      pgPassword: '',
    },
    readConfig(),
  );
  writeConfig(cfg);
  let pool = makePool(cfg);
  let pairedLogged = false;

  while (!stopping) {
    try {
      cfg = await ensureEnrolled(cfg);
      const cloud = (cfg.cloudUrl || 'https://react-delta-bice-16.vercel.app').replace(/\/$/, '');
      const poll = await postJson(`${cloud}/api/agent/poll`, {
        agentId: cfg.agentId,
        secret: cfg.secret,
      });
      if (poll.pairCode) writePairCode(poll.pairCode);
      if (poll.paired && !pairedLogged) {
        pairedLogged = true;
        log('FR Rapor ile eslendi, sorgular iletiliyor');
      }
      for (const job of poll.jobs || []) {
        try {
          const result = await pool.query(job.sql, job.params || []);
          await postJson(`${cloud}/api/agent/job-result`, {
            agentId: cfg.agentId,
            secret: cfg.secret,
            jobId: job.id,
            rows: result.rows,
          });
        } catch (jobErr) {
          await postJson(`${cloud}/api/agent/job-result`, {
            agentId: cfg.agentId,
            secret: cfg.secret,
            jobId: job.id,
            error: jobErr.message || String(jobErr),
          });
        }
      }
      await new Promise((r) => setTimeout(r, (poll.jobs || []).length ? 80 : 600));
    } catch (err) {
      const detail =
        (err && err.cause && (err.cause.message || String(err.cause))) ||
        (err && err.message) ||
        String(err);
      log('dongu hata: ' + detail);
      try {
        await pool.end();
      } catch (_) {}
      cfg = Object.assign(cfg, readConfig());
      pool = makePool(cfg);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  try {
    await pool.end();
  } catch (_) {}
}

mainLoop().catch((err) => {
  log('fatal ' + (err && err.stack ? err.stack : err));
  setTimeout(() => process.exit(1), 1500);
});
