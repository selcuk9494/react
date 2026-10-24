'use strict';

/**
 * agentId → tek aktif WebSocket. Yeni auth eski soketi kapatır.
 */
function createConnectionRegistry(maxAgents) {
  /** @type {Map<string, { ws: import('ws').WebSocket, meta: any, lastSeen: number }>} */
  const byAgent = new Map();

  return {
    size() {
      return byAgent.size;
    },
    has(agentId) {
      return byAgent.has(String(agentId));
    },
    get(agentId) {
      return byAgent.get(String(agentId)) || null;
    },
    listIds() {
      return [...byAgent.keys()];
    },
    /**
     * @returns {{ ok: true } | { ok: false, reason: string }}
     */
    set(agentId, ws, meta = {}) {
      const id = String(agentId);
      if (!byAgent.has(id) && byAgent.size >= maxAgents) {
        return { ok: false, reason: 'max_agents' };
      }
      const prev = byAgent.get(id);
      if (prev && prev.ws !== ws) {
        try {
          prev.ws.close(4000, 'replaced');
        } catch (_) {}
      }
      byAgent.set(id, { ws, meta, lastSeen: Date.now() });
      return { ok: true };
    },
    touch(agentId) {
      const row = byAgent.get(String(agentId));
      if (row) row.lastSeen = Date.now();
    },
    remove(agentId, ws) {
      const id = String(agentId);
      const row = byAgent.get(id);
      if (row && (!ws || row.ws === ws)) byAgent.delete(id);
    },
    send(agentId, payload) {
      const row = byAgent.get(String(agentId));
      if (!row || row.ws.readyState !== 1) return false;
      try {
        row.ws.send(JSON.stringify(payload));
        return true;
      } catch (_) {
        return false;
      }
    },
  };
}

module.exports = { createConnectionRegistry };
