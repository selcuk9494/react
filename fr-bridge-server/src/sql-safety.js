'use strict';

/**
 * SQL mutasyon sınıflandırması.
 * Belirsiz / yazma işleri otomatik reclaim ile yeniden çalıştırılmaz.
 */

function stripSqlNoise(sql) {
  let s = String(sql || '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/--[^\n]*/g, ' ');
  return s.trim();
}

function isMutatingSql(sql) {
  const s = stripSqlNoise(sql);
  if (!s) return false;
  if (s === '__BATCH__') return true; // parçalar ayrıca incelenir
  return /^(WITH\b[\s\S]*?\bAS\b[\s\S]*?)?(INSERT|UPDATE|DELETE|UPSERT|MERGE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|DO|REFRESH|VACUUM|CLUSTER|REINDEX|COPY)\b/i.test(
    s,
  );
}

function isMutatingJob(job) {
  if (!job) return false;
  if (job.sql === '__BATCH__') {
    const parts = Array.isArray(job.params) ? job.params : [];
    if (!parts.length) return true; // bilinmeyen batch → muhafazakâr
    return parts.some((p) => isMutatingSql(p?.sql));
  }
  return isMutatingSql(job.sql);
}

/** Belirsiz yazma sonucu — otomatik retry yok */
const AMBIGUOUS_WRITE_ERROR = 'ambiguous_write_needs_review';

module.exports = {
  stripSqlNoise,
  isMutatingSql,
  isMutatingJob,
  AMBIGUOUS_WRITE_ERROR,
};
