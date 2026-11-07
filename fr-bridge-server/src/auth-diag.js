'use strict';

/** Tanılama yalnızca bu ajan içindir. Diğer ajanların yolu aynı kalır. */
const BRANCH_151_AGENT_ID = '38dc3ad9-13c7-45a0-a7d3-86dc4948093e';

function isBranch151(agentId) {
  return String(agentId || '') === BRANCH_151_AGENT_ID;
}

function writeDiag(log, line) {
  if (typeof log !== 'function') return;
  try {
    log(line);
  } catch (_) {}
}

function note151(agentId, log, line) {
  if (!isBranch151(agentId)) return;
  writeDiag(log, line);
}

/**
 * auth.ok çerçevesi. Diğer ajanlarda callback yok; 151'de sonuç ayrıca yazılır.
 * Hata metni, adres ve secret loglanmaz.
 */
function sendAuthOk(ws, payload, log) {
  const diag = isBranch151(ws && ws.agentId);
  if (!ws || ws.readyState !== 1) {
    if (diag) writeDiag(log, 'diag151 auth.ok dropped');
    return;
  }
  let body;
  try {
    body = JSON.stringify(payload);
  } catch (_) {
    if (diag) writeDiag(log, 'diag151 auth.ok send error');
    return;
  }
  try {
    if (diag) {
      writeDiag(log, 'diag151 auth.ok send attempted');
      ws.send(body, (err) => {
        writeDiag(log, err ? 'diag151 auth.ok send error' : 'diag151 auth.ok send ok');
      });
    } else {
      ws.send(body);
    }
  } catch (_) {
    if (diag) writeDiag(log, 'diag151 auth.ok send error');
  }
}

module.exports = {
  BRANCH_151_AGENT_ID,
  isBranch151,
  note151,
  sendAuthOk,
};
