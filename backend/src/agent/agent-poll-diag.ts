/**
 * Geçici poll sayacı. Yalnızca AGENT_POLL_DIAG=1 iken,
 * doğrulanmış agent kimliği ve şube numarası yazılır.
 * Secret, gövde ve SQL bu modüle girmez.
 */
const AGENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatAgentPollDiag(agent: {
  id?: unknown;
  branch_id?: unknown;
}): string {
  const rawId = String(agent?.id ?? '');
  const agentId = AGENT_ID_RE.test(rawId) ? rawId.toLowerCase() : 'invalid';
  let branch = '0';
  if (agent?.branch_id != null && agent.branch_id !== '') {
    const n = Number(agent.branch_id);
    if (Number.isInteger(n) && n >= 0 && n <= 1_000_000) branch = String(n);
  }
  return `diag_poll agent=${agentId} branch=${branch}`;
}

export function writeAgentPollDiag(
  agent: { id?: unknown; branch_id?: unknown },
  env: NodeJS.ProcessEnv = process.env,
  log: (line: string) => void = console.log,
): void {
  if (env.AGENT_POLL_DIAG !== '1') return;
  try {
    log(formatAgentPollDiag(agent));
  } catch {
    // Log hatası poll yanıtını ve iş kuyruğunu durdurmaz.
  }
}
