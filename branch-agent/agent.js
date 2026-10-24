'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');
const {
  IDLE_POLL_MS,
  nextDelayMs,
  createSingleFlight,
} = require('./poll-policy');
const {
  resolveWsUrl,
  resolveTransport,
  createWsBridge,
} = require('./ws-transport');
const {
  isMutatingJob,
  AMBIGUOUS_WRITE_ERROR,
} = require('./sql-safety');

/** Aynı jobId'nin ikinci kez SQL çalıştırmasını engeller (WS+HTTP yarışı / reconnect). */
const localJobState = new Map();
const LOCAL_JOB_CAP = 500;

function rememberJob(jobId, state) {
  localJobState.set(String(jobId), state);
  if (localJobState.size > LOCAL_JOB_CAP) {
    const first = localJobState.keys().next().value;
    localJobState.delete(first);
  }
}

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
    let raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // UTF-8 BOM (PowerShell)
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const prev = readConfig();
  const next = Object.assign({}, prev, cfg);
  // Bos sifre ile onceki sifreyi ezme
  if (!next.pgPassword && prev.pgPassword) next.pgPassword = prev.pgPassword;
  if (!next.agentId && prev.agentId) next.agentId = prev.agentId;
  if (!next.secret && prev.secret) next.secret = prev.secret;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), { encoding: 'utf8' });
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
    max: 8,
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

async function buildDashboardSnapshot(pool, meta) {
  const kasaNos = meta.kasaNos || [1];
  const emptyDagilim = () => ({
    acik_adet: 0,
    acik_toplam: 0,
    kapali_adet: 0,
    kapali_toplam: 0,
    kapali_iskonto: 0,
    toplam_adet: 0,
    toplam_tutar: 0,
    acik_yuzde: 0,
    kapali_yuzde: 0,
  });
  const result = {
    acik_adisyon_toplam: 0,
    kapali_adisyon_toplam: 0,
    kapali_iskonto_toplam: 0,
    iptal_toplam: 0,
    borca_atilan_toplam: 0,
    borca_atilan_adet: 0,
    odenmez_toplam: 0,
    odenmez_adet: 0,
    acik_adisyon_adet: 0,
    kapali_adisyon_adet: 0,
    iptal_adet: 0,
    kasa_raporu: { nakit: 0, kredi_karti: 0, yemek_karti: 0, diger: 0, toplam: 0 },
    dagilim: { paket: emptyDagilim(), adisyon: emptyDagilim(), hizli: emptyDagilim() },
    _from_agent: true,
  };

  const openSql = `
    WITH per_ads AS (
      SELECT a.adsno,
        CASE
          WHEN COALESCE(a.adtur, 0) = 1 OR COALESCE(a.masano, 0) = 99999 OR COALESCE(a.sipyer, 0) = 2 THEN 'paket'
          WHEN COALESCE(a.adtur, 0) = 3 THEN 'hizli'
          ELSE 'adisyon'
        END as type,
        COALESCE(SUM(CASE WHEN COALESCE(a.sturu, 0) IN (1, 2, 4) THEN 0 ELSE COALESCE(a.tutar, 0) END), 0) as tutar
      FROM ads_acik a
      WHERE a.kasa = ANY($1)
      GROUP BY a.adsno, type
    )
    SELECT type, COUNT(*)::int as adet, COALESCE(SUM(tutar), 0) as toplam
    FROM per_ads GROUP BY type`;
  const closedSql = `
    SELECT
      CASE
        WHEN COALESCE(o.adtur, 0) = 1 THEN 'paket'
        WHEN COALESCE(o.adtur, 0) = 3 THEN 'hizli'
        ELSE 'adisyon'
      END as type,
      COUNT(DISTINCT o.adsno)::int as adet,
      COALESCE(SUM(COALESCE(o.otutar, 0)), 0) as net_toplam,
      COALESCE(SUM(COALESCE(o.iskonto, 0)), 0) as iskonto_toplam
    FROM ads_odeme o
    WHERE o.kasa = ANY($1)
      AND o.raptar >= CURRENT_DATE
      AND o.raptar < (CURRENT_DATE + interval '1 day')
    GROUP BY 1`;
  const cashSql = `
    SELECT COALESCE(SUM(COALESCE(o.otutar, 0)), 0) as toplam
    FROM ads_odeme o
    WHERE o.kasa = ANY($1)
      AND o.raptar >= CURRENT_DATE
      AND o.raptar < (CURRENT_DATE + interval '1 day')`;

  const [openRows, closedRows, cashRows] = await Promise.all([
    pool.query(openSql, [kasaNos]),
    pool.query(closedSql, [kasaNos]),
    pool.query(cashSql, [kasaNos]),
  ]);

  for (const r of openRows.rows || []) {
    const g = result.dagilim[r.type];
    if (!g) continue;
    const adet = Number(r.adet) || 0;
    const toplam = Number(r.toplam) || 0;
    result.acik_adisyon_adet += adet;
    result.acik_adisyon_toplam += toplam;
    g.acik_adet += adet;
    g.acik_toplam += toplam;
  }
  for (const r of closedRows.rows || []) {
    const g = result.dagilim[r.type];
    if (!g) continue;
    const adet = Number(r.adet) || 0;
    const net = Number(r.net_toplam) || 0;
    const isk = Number(r.iskonto_toplam) || 0;
    result.kapali_adisyon_adet += adet;
    result.kapali_adisyon_toplam += net;
    result.kapali_iskonto_toplam += isk;
    g.kapali_adet += adet;
    g.kapali_toplam += net;
    g.kapali_iskonto += isk;
  }
  result.kasa_raporu.toplam = Number(cashRows.rows?.[0]?.toplam) || 0;
  for (const key of ['adisyon', 'paket', 'hizli']) {
    const g = result.dagilim[key];
    g.toplam_adet = g.acik_adet + g.kapali_adet;
    g.toplam_tutar = g.acik_toplam + g.kapali_toplam;
  }
  return result;
}

const loopFlight = createSingleFlight();

/**
 * @param {'ws'|'http'} via — job hangi kanaldan geldi (log; secret/SQL yok)
 */
async function processJobs(cloud, cfg, pool, jobs, via = 'http') {
  if (!jobs.length) return;
  const channel = via === 'ws' ? 'ws' : 'http';
  log(`jobs received via=${channel} count=${jobs.length}`);
  await Promise.all(
    jobs.map(async (job) => {
      const id = String(job.id);
      const prev = localJobState.get(id);
      if (prev === 'done' || prev === 'running' || prev === 'ambiguous') {
        log(
          `job id=${id} via=${channel} atlandi localState=${prev} — cift execution engeli`,
        );
        return;
      }
      rememberJob(id, 'running');
      const mutating = isMutatingJob(job);
      const kind = job.sql === '__BATCH__' ? 'batch' : mutating ? 'write' : 'read';
      const t0 = Date.now();
      log(`job start id=${id} via=${channel} kind=${kind}`);
      let sqlRan = false;
      try {
        if (job.sql === '__BATCH__') {
          const parts = Array.isArray(job.params) ? job.params : [];
          const batch = [];
          for (const part of parts) {
            const result = await pool.query(part.sql, part.params || []);
            sqlRan = true;
            batch.push(result.rows);
          }
          await postJson(`${cloud}/api/agent/job-result`, {
            agentId: cfg.agentId,
            secret: cfg.secret,
            jobId: job.id,
            rows: batch,
            batch,
          });
        } else {
          const result = await pool.query(job.sql, job.params || []);
          sqlRan = true;
          await postJson(`${cloud}/api/agent/job-result`, {
            agentId: cfg.agentId,
            secret: cfg.secret,
            jobId: job.id,
            rows: result.rows,
          });
        }
        rememberJob(id, 'done');
        log(`job done id=${id} via=${channel} kind=${kind} ms=${Date.now() - t0}`);
      } catch (jobErr) {
        const errMsg = jobErr.message || String(jobErr);
        // Yazma SQL calisti ama sonuc belirsiz / hata: otomatik tekrar YOK
        if (mutating && sqlRan) {
          rememberJob(id, 'ambiguous');
          try {
            await postJson(`${cloud}/api/agent/job-result`, {
              agentId: cfg.agentId,
              secret: cfg.secret,
              jobId: job.id,
              error: AMBIGUOUS_WRITE_ERROR + ': ' + errMsg,
            });
          } catch (_) {
            log(
              `CRITICAL job id=${id} via=${channel}: yazma calisti, job-result yok — sunucu reclaim yazmayi tekrarlamamali`,
            );
          }
          log(
            `job ambiguous id=${id} via=${channel} kind=${kind} ms=${Date.now() - t0}`,
          );
          return;
        }
        try {
          await postJson(`${cloud}/api/agent/job-result`, {
            agentId: cfg.agentId,
            secret: cfg.secret,
            jobId: job.id,
            error: errMsg,
          });
          rememberJob(id, 'done');
          log(
            `job error-reported id=${id} via=${channel} kind=${kind} ms=${Date.now() - t0}`,
          );
        } catch (reportErr) {
          if (mutating && sqlRan) {
            rememberJob(id, 'ambiguous');
          } else {
            localJobState.delete(id); // read: sunucu reclaim ile tekrar deneyebilir
          }
          log(
            `job-result gonderilemedi id=${id} via=${channel} err=${reportErr.message || reportErr}`,
          );
        }
      }
    }),
  );
}

async function maybePushSnapshot(cloud, cfg, pool, session, lastSnapshotAtRef) {
  if (!session?.paired || !session?.snapshot) return lastSnapshotAtRef.value;
  if (Date.now() - lastSnapshotAtRef.value <= 15000) return lastSnapshotAtRef.value;
  try {
    const payload = await buildDashboardSnapshot(pool, session.snapshot);
    await postJson(`${cloud}/api/agent/dashboard-snapshot`, {
      agentId: cfg.agentId,
      secret: cfg.secret,
      period: session.snapshot.period || 'today',
      payload,
    });
    lastSnapshotAtRef.value = Date.now();
    log('dashboard snapshot gonderildi');
  } catch (snapErr) {
    log('snapshot hata: ' + (snapErr.message || snapErr));
  }
  return lastSnapshotAtRef.value;
}

async function mainLoop() {
  if (!loopFlight.tryEnter()) {
    log('mainLoop zaten calisiyor — ikinci ornek engellendi');
    return;
  }
  let wsBridge = null;
  try {
    let cfg = Object.assign(
      {
        cloudUrl: 'https://react-delta-bice-16.vercel.app',
        pgHost: '127.0.0.1',
        pgPort: 5432,
        pgDatabase: 'fastrest',
        pgUser: 'begum',
        pgPassword: '',
        // http | auto | ws — varsayilan http (mevcut musteriler); Microvise test: auto+bridgeWsUrl
        transport: 'http',
        bridgeWsUrl: '',
      },
      readConfig(),
    );
    writeConfig(cfg);
    let pool = makePool(cfg);
    let pairedLogged = false;
    const lastSnapshotAtRef = { value: 0 };
    let errorStreak = 0;
    /** @type {any} */
    let lastSession = null;
    let jobChain = Promise.resolve();

    const transport = resolveTransport(cfg);
    const wsUrl = resolveWsUrl(cfg);
    const wsDesired = (transport === 'ws' || transport === 'auto') && !!wsUrl;

    log(
      `poll politikasi: idle=${IDLE_POLL_MS}ms, busy=hemen, backoff=exp+jitter; transport=${transport}` +
        (wsUrl ? ` ws=${wsUrl}` : ''),
    );

    const enqueueJobs = (cloud, localCfg, jobs, via) => {
      if (!jobs?.length) return;
      jobChain = jobChain
        .then(() => processJobs(cloud, localCfg, pool, jobs, via))
        .catch((err) => log('jobChain hata: ' + (err.message || err)));
      return jobChain;
    };

    const ensureWs = (localCfg, cloud) => {
      if (!wsDesired) return;
      if (wsBridge) return;
      wsBridge = createWsBridge({
        wsUrl,
        agentId: localCfg.agentId,
        secret: localCfg.secret,
        log,
        onSession(session) {
          lastSession = session;
          if (session.pairCode) writePairCode(session.pairCode);
          if (session.paired && !pairedLogged) {
            pairedLogged = true;
            log('FR Rapor ile eslendi (ws), sorgular iletiliyor');
          }
          void maybePushSnapshot(cloud, localCfg, pool, session, lastSnapshotAtRef);
        },
        onJobs(jobs) {
          return enqueueJobs(cloud, localCfg, jobs, 'ws');
        },
      });
      wsBridge.start();
    };

    while (!stopping) {
      let hadJobs = false;
      try {
        cfg = await ensureEnrolled(cfg);
        const cloud = (cfg.cloudUrl || 'https://react-delta-bice-16.vercel.app').replace(
          /\/$/,
          '',
        );
        ensureWs(cfg, cloud);

        const wsUp = wsBridge && wsBridge.isConnected();
        if (wsUp) {
          // WSS aktif: HTTP poll yok (Vercel yuku dusuk). Snapshot ping/auth.ok ile.
          await maybePushSnapshot(cloud, cfg, pool, lastSession, lastSnapshotAtRef);
          errorStreak = 0;
          await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
        } else {
          // HTTP poll: transport=http veya WS dusukken fallback
          if (wsDesired && !wsUp) {
            log('ws kapali — HTTP poll fallback');
          }
          const poll = await postJson(`${cloud}/api/agent/poll`, {
            agentId: cfg.agentId,
            secret: cfg.secret,
          });
          lastSession = poll;
          if (poll.pairCode) writePairCode(poll.pairCode);
          if (poll.paired && !pairedLogged) {
            pairedLogged = true;
            log('FR Rapor ile eslendi, sorgular iletiliyor');
          }
          const jobs = poll.jobs || [];
          hadJobs = jobs.length > 0;
          await enqueueJobs(cloud, cfg, jobs, 'http');
          await maybePushSnapshot(cloud, cfg, pool, poll, lastSnapshotAtRef);

          errorStreak = 0;
          const delay = nextDelayMs({ hadJobs, errorStreak: 0 });
          if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        }
      } catch (err) {
        errorStreak = Math.min(errorStreak + 1, 8);
        const detail =
          (err && err.cause && (err.cause.message || String(err.cause))) ||
          (err && err.message) ||
          String(err);
        const backoff = nextDelayMs({ hadJobs: false, errorStreak });
        log(`dongu hata (streak=${errorStreak}, backoff=${backoff}ms): ${detail}`);
        try {
          await pool.end();
        } catch (_) {}
        // Config'teki agentId/secret korunur — pending isler bulutta kalir
        cfg = Object.assign({}, readConfig(), cfg);
        pool = makePool(cfg);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    try {
      wsBridge?.stop();
    } catch (_) {}
    try {
      await pool.end();
    } catch (_) {}
  } finally {
    try {
      wsBridge?.stop();
    } catch (_) {}
    loopFlight.leave();
  }
}

mainLoop().catch((err) => {
  log('fatal ' + (err && err.stack ? err.stack : err));
  setTimeout(() => process.exit(1), 1500);
});
