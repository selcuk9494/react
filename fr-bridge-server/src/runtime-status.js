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

module.exports = { createRuntimeStatus };
