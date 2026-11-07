import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AgentService } from './agent.service';
import { formatAgentPollDiag, writeAgentPollDiag } from './agent-poll-diag';

const AGENT_ID = '6ff4b20d-a4ff-4dae-87f9-ce754d9a127b';
const SECRET = 'test-secret';

function hash(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

function agentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_ID,
    secret_hash: hash(SECRET),
    status: 'paired',
    branch_id: 152,
    pair_code: 'ABC-DEF',
    ...overrides,
  };
}

function serviceWith(row: any, jobs: any[] = []) {
  const queries: string[] = [];
  const db = {
    getMainPool: () => ({ name: 'pool' }),
    executeQuery: jest.fn(async (_pool: unknown, sql: string) => {
      queries.push(sql);
      if (sql.includes('FROM branch_agents WHERE id')) return row ? [row] : [];
      if (sql.includes('branch_kasas')) return [{ kasa_no: 1 }];
      if (sql.includes('FROM branches WHERE id')) {
        return [{ kasa_no: 1, closing_hour: 6 }];
      }
      if (sql.includes('UPDATE agent_jobs')) return jobs;
      return [];
    }),
  };
  const service = new AgentService(db as any, {} as any);
  return { service, db, queries };
}

describe('agent poll diagnostic line', () => {
  const saved = process.env.AGENT_POLL_DIAG;

  afterEach(() => {
    if (saved === undefined) delete process.env.AGENT_POLL_DIAG;
    else process.env.AGENT_POLL_DIAG = saved;
    jest.restoreAllMocks();
  });

  it('stays silent unless AGENT_POLL_DIAG is exactly 1', () => {
    const log = jest.fn();
    for (const value of [undefined, '', '0', 'true', 'yes']) {
      const env: NodeJS.ProcessEnv = {};
      if (value !== undefined) env.AGENT_POLL_DIAG = value;
      writeAgentPollDiag({ id: AGENT_ID, branch_id: 152 }, env, log);
    }
    expect(log).not.toHaveBeenCalled();
  });

  it('logs only the verified id and branch number', () => {
    const line = formatAgentPollDiag({
      id: AGENT_ID.toUpperCase(),
      branch_id: '153',
      secret: SECRET,
      secret_hash: hash(SECRET),
      pair_code: 'ABC-DEF',
      sql: 'SELECT secret FROM orders',
    } as any);
    expect(line).toBe(
      'diag_poll agent=6ff4b20d-a4ff-4dae-87f9-ce754d9a127b branch=153',
    );
    expect(line).not.toContain(SECRET);
    expect(line).not.toContain('SELECT');
    expect(line).not.toContain('ABC-DEF');
  });

  it('uses branch 0 when the agent has no branch and hides unexpected ids', () => {
    expect(formatAgentPollDiag({ id: AGENT_ID, branch_id: null })).toBe(
      `diag_poll agent=${AGENT_ID} branch=0`,
    );
    expect(
      formatAgentPollDiag({ id: 'not-a-uuid\nsecret=1', branch_id: -3 }),
    ).toBe('diag_poll agent=invalid branch=0');
  });

  it('swallows a throwing logger', () => {
    expect(() =>
      writeAgentPollDiag(
        { id: AGENT_ID, branch_id: 152 },
        { AGENT_POLL_DIAG: '1' },
        () => {
          throw new Error('log failed');
        },
      ),
    ).not.toThrow();
  });
});

describe('POST /api/agent/poll diagnostic boundary', () => {
  const saved = process.env.AGENT_POLL_DIAG;

  afterEach(() => {
    if (saved === undefined) delete process.env.AGENT_POLL_DIAG;
    else process.env.AGENT_POLL_DIAG = saved;
    jest.restoreAllMocks();
  });

  it('does not log when authentication fails', async () => {
    process.env.AGENT_POLL_DIAG = '1';
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { service, queries } = serviceWith(null);
    await expect(service.poll(AGENT_ID, SECRET)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(log).not.toHaveBeenCalled();
    expect(queries.some((sql) => sql.includes('last_seen_at'))).toBe(false);
  });

  it('logs after successful auth and keeps the poll response', async () => {
    process.env.AGENT_POLL_DIAG = '1';
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const job = {
      id: 'job-1',
      sql: 'SELECT 1',
      params: ['secret-param'],
    };
    const { service, queries } = serviceWith(agentRow(), [job]);
    const result = await service.poll(AGENT_ID, SECRET);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toBe(
      `diag_poll agent=${AGENT_ID} branch=152`,
    );
    expect(String(log.mock.calls[0][0])).not.toContain(SECRET);
    expect(String(log.mock.calls[0][0])).not.toContain('SELECT');
    expect(result).toEqual({
      paired: true,
      pairCode: null,
      snapshot: {
        branchId: 152,
        kasaNos: [1],
        closingHour: 6,
        period: 'today',
      },
      jobs: [job],
    });
    expect(queries.some((sql) => sql.includes('last_seen_at'))).toBe(true);
    expect(queries.some((sql) => sql.includes('UPDATE agent_jobs'))).toBe(true);
  });

  it('keeps polling and the job claim when diagnostics are off', async () => {
    delete process.env.AGENT_POLL_DIAG;
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { service } = serviceWith(agentRow(), []);
    const result = await service.poll(AGENT_ID, SECRET);
    expect(log).not.toHaveBeenCalled();
    expect(result.jobs).toEqual([]);
    expect(result.paired).toBe(true);
  });

  it('still returns jobs when the diagnostic log throws', async () => {
    process.env.AGENT_POLL_DIAG = '1';
    jest.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('stdout failed');
    });
    const job = { id: 'job-2', sql: 'SELECT 2', params: [] };
    const { service, queries } = serviceWith(agentRow({ branch_id: 153 }), [
      job,
    ]);
    const result = await service.poll(AGENT_ID, SECRET);
    expect(result.jobs).toEqual([job]);
    expect(result.snapshot.branchId).toBe(153);
    expect(queries.some((sql) => sql.includes('UPDATE agent_jobs'))).toBe(true);
  });
});
