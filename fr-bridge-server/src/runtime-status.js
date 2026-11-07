'use strict';

/**
 * Paylaşılan sağlık durumu (HTTP /health + LISTEN + pool probe).
 */
function createRuntimeStatus() {
  return {
    postgres: {
      ok: false,
      lastCheckAt: null,
      lastError: null,
    },
    listen: {
      listening: false,
      phase: 'not_started',
      lastError: null,
      lastConnectedAt: null,
      attempts: 0,
      channel: null,
    },
    safetyPoll: {
      lastOkAt: null,
      lastErrorAt: null,
      lastError: null,
      consecutiveFailures: 0,
    },
  };
}

/**
 * HTTP 200 ile kesime hazır olmak ayrıdır.
 * connecting / not_started, başlangıç penceresinde 200 döner (Render health check süreci öldürmesin).
 * ready yalnızca LISTEN gerçekten açıkken true. Ajan sayısı bu karara girmez.
 */
function evaluateHealth({
  postgresOk,
  listenWanted,
  phase,
  withinStartupGrace,
  lastError,
}) {
  const listenReady = phase === 'listening';
  const starting =
    (phase === 'connecting' || phase === 'not_started') &&
    withinStartupGrace &&
    !lastError;
  const ok = Boolean(postgresOk) && (!listenWanted || listenReady || starting);
  const ready = Boolean(postgresOk) && (!listenWanted || listenReady);
  return { ok, ready, starting: Boolean(starting) };
}

module.exports = { createRuntimeStatus, evaluateHealth };
