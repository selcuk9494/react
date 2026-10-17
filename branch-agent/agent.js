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
  let fastUntil = 0;
  let lastSnapshotAt = 0;

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
      const jobs = poll.jobs || [];
      if (jobs.length) fastUntil = Date.now() + 30000;

      await Promise.all(
        jobs.map(async (job) => {
          try {
            if (job.sql === '__BATCH__') {
              const parts = Array.isArray(job.params) ? job.params : [];
              const batch = [];
              for (const part of parts) {
                const result = await pool.query(part.sql, part.params || []);
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
              await postJson(`${cloud}/api/agent/job-result`, {
                agentId: cfg.agentId,
                secret: cfg.secret,
                jobId: job.id,
                rows: result.rows,
              });
            }
          } catch (jobErr) {
            await postJson(`${cloud}/api/agent/job-result`, {
              agentId: cfg.agentId,
              secret: cfg.secret,
              jobId: job.id,
              error: jobErr.message || String(jobErr),
            });
          }
        }),
      );

      // Her 15 sn'de bir ozet buluta yaz — kullanici uzak DB beklemez
      if (poll.paired && poll.snapshot && Date.now() - lastSnapshotAt > 15000) {
        try {
          const payload = await buildDashboardSnapshot(pool, poll.snapshot);
          await postJson(`${cloud}/api/agent/dashboard-snapshot`, {
            agentId: cfg.agentId,
            secret: cfg.secret,
            period: poll.snapshot.period || 'today',
            payload,
          });
          lastSnapshotAt = Date.now();
          log('dashboard snapshot gonderildi');
        } catch (snapErr) {
          log('snapshot hata: ' + (snapErr.message || snapErr));
        }
      }

      const delay = jobs.length ? 30 : Date.now() < fastUntil ? 80 : 150;
      await new Promise((r) => setTimeout(r, delay));
    } catch (err) {
      const detail =
        (err && err.cause && (err.cause.message || String(err.cause))) ||
        (err && err.message) ||
        String(err);
      log('dongu hata: ' + detail);
      try {
        await pool.end();
      } catch (_) {}
      cfg = Object.assign({}, readConfig(), cfg);
      pool = makePool(cfg);
      await new Promise((r) => setTimeout(r, 2000));
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
