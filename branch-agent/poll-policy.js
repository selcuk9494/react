'use strict';

/** Boşta bulut poll aralığı (P0: 150ms → 3s). */
const IDLE_POLL_MS = 3000;
/** İş batch'i bittikten sonra hemen yeniden poll (gereksiz bekleme yok). */
const BUSY_POLL_MS = 0;
/** Hata sonrası ilk bekleme. */
const ERR_BACKOFF_BASE_MS = 2000;
/** Hata backoff tavanı (Vercel/ağ fırtınasını sınırlar). */
const ERR_BACKOFF_MAX_MS = 60000;

/**
 * Bir sonraki poll öncesi bekleme.
 * @param {{ hadJobs: boolean, errorStreak: number, random?: () => number }} opts
 */
function nextDelayMs(opts) {
  const errorStreak = Math.max(0, Number(opts?.errorStreak) || 0);
  const random = typeof opts?.random === 'function' ? opts.random : Math.random;
  if (errorStreak > 0) {
    const exp = Math.min(
      ERR_BACKOFF_MAX_MS,
      ERR_BACKOFF_BASE_MS * Math.pow(2, errorStreak - 1),
    );
    const jitter = exp * 0.2 * (random() * 2 - 1);
    return Math.max(500, Math.round(exp + jitter));
  }
  return opts?.hadJobs ? BUSY_POLL_MS : IDLE_POLL_MS;
}

/** Aynı anda tek poll/iş turu — çift mainLoop / yeniden giriş koruması. */
function createSingleFlight() {
  let busy = false;
  return {
    tryEnter() {
      if (busy) return false;
      busy = true;
      return true;
    },
    leave() {
      busy = false;
    },
    get isBusy() {
      return busy;
    },
  };
}

module.exports = {
  IDLE_POLL_MS,
  BUSY_POLL_MS,
  ERR_BACKOFF_BASE_MS,
  ERR_BACKOFF_MAX_MS,
  nextDelayMs,
  createSingleFlight,
};
