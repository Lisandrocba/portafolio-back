import { describe, expect, it, vi } from 'vitest';
import {
  createQuotaService,
  startOfDayInCordoba,
  type QuotaServiceDeps,
  type VisitorQuotaState,
} from './quota.service.js';

// Unit tests: fake repo (plain object implementing the 3 methods) + injected clock (`now`).

const CONFIG = { queryLimit: 5, hardMessageLimit: 20, dailyGlobalLimit: 3 };

const STATE: VisitorQuotaState = {
  used: 0,
  totalUser: 0,
  anyRecruiter: false,
  leadCaptured: false,
};

function fakeRepo(): QuotaServiceDeps['repo'] {
  return {
    countVisitorMessagesSince: vi.fn(async () => ({
      substantiveUserMessages: 2,
      totalUserMessages: 7,
    })),
    hasRecruiterIntent: vi.fn(async () => true),
    hasLead: vi.fn(async () => false),
  };
}

/** A quota service whose clock the test can move. */
function quotaAt(isoDate: string, repo = fakeRepo()) {
  const clock = { now: new Date(isoDate) };
  const quota = createQuotaService({ repo, config: CONFIG, now: () => clock.now });
  return { quota, clock, repo };
}

describe('startOfDayInCordoba', () => {
  it('23:59 Córdoba (02:59 UTC next day) still belongs to the previous day', () => {
    expect(startOfDayInCordoba(new Date('2026-11-24T02:59:59Z'))).toEqual(
      new Date('2026-11-23T03:00:00Z'),
    );
  });

  it('00:00 Córdoba (03:00 UTC) starts a new day', () => {
    expect(startOfDayInCordoba(new Date('2026-11-24T03:00:00Z'))).toEqual(
      new Date('2026-11-24T03:00:00Z'),
    );
  });

  it('ignores milliseconds', () => {
    expect(startOfDayInCordoba(new Date('2026-11-23T15:30:45.678Z'))).toEqual(
      new Date('2026-11-23T03:00:00Z'),
    );
  });
});

describe('quota.checkLimits', () => {
  const { quota } = quotaAt('2026-11-23T15:00:00Z');

  it('used = LIMIT - 1 → null (the query that exhausts the limit is answered)', () => {
    expect(quota.checkLimits({ ...STATE, used: 4 })).toBeNull();
  });

  it('used = LIMIT → QUERY_LIMIT', () => {
    expect(quota.checkLimits({ ...STATE, used: 5 })).toBe('QUERY_LIMIT');
  });

  it('totalUser = HARD_LIMIT with few substantive → ABUSE_LIMIT', () => {
    expect(quota.checkLimits({ ...STATE, used: 1, totalUser: 20 })).toBe('ABUSE_LIMIT');
  });

  it('global counter at the cap → GLOBAL_LIMIT', () => {
    const { quota: fresh } = quotaAt('2026-11-23T15:00:00Z');
    fresh.registerLlmCall();
    fresh.registerLlmCall();
    expect(fresh.checkLimits(STATE)).toBeNull();

    fresh.registerLlmCall();
    expect(fresh.checkLimits(STATE)).toBe('GLOBAL_LIMIT');
  });

  it('global counter resets when the Córdoba day changes', () => {
    const { quota: fresh, clock } = quotaAt('2026-11-24T02:59:00Z'); // 23:59 in Córdoba
    fresh.registerLlmCall();
    fresh.registerLlmCall();
    fresh.registerLlmCall();
    expect(fresh.checkLimits(STATE)).toBe('GLOBAL_LIMIT');

    clock.now = new Date('2026-11-24T03:00:00Z'); // 00:00 in Córdoba
    expect(fresh.checkLimits(STATE)).toBeNull();
  });
});

describe('quota.getVisitorState', () => {
  it('counts only since the start of the Córdoba day (yesterday does not count)', async () => {
    const { quota, repo } = quotaAt('2026-11-23T15:00:00Z');

    const state = await quota.getVisitorState('visitor-1');

    expect(repo.countVisitorMessagesSince).toHaveBeenCalledWith(
      'visitor-1',
      new Date('2026-11-23T03:00:00Z'),
    );
    expect(state).toEqual({ used: 2, totalUser: 7, anyRecruiter: true, leadCaptured: false });
  });

  it('another visitorId has its own quota', async () => {
    const { quota, repo } = quotaAt('2026-11-23T15:00:00Z');

    await quota.getVisitorState('visitor-2');

    expect(repo.countVisitorMessagesSince).toHaveBeenCalledWith('visitor-2', expect.any(Date));
    expect(repo.hasRecruiterIntent).toHaveBeenCalledWith('visitor-2');
    expect(repo.hasLead).toHaveBeenCalledWith('visitor-2');
  });
});

describe('quota.computeOutcome', () => {
  const { quota } = quotaAt('2026-11-23T15:00:00Z');
  const trivial = { substantive: false, recruiterIntent: false };
  const substantive = { substantive: true, recruiterIntent: false };

  it('substantive message decrements remaining; trivial does not', () => {
    expect(quota.computeOutcome({ ...STATE, used: 1 }, substantive).remaining).toBe(3);
    expect(quota.computeOutcome({ ...STATE, used: 1 }, trivial).remaining).toBe(4);
  });

  it('remaining never goes below 0', () => {
    expect(quota.computeOutcome({ ...STATE, used: 9 }, substantive).remaining).toBe(0);
  });

  it('last query (remaining 0) → showCta true', () => {
    expect(quota.computeOutcome({ ...STATE, used: 4 }, substantive)).toEqual({
      remaining: 0,
      showCta: true,
    });
  });

  it('no recruiter and queries left → showCta false', () => {
    expect(quota.computeOutcome({ ...STATE, used: 1 }, substantive).showCta).toBe(false);
  });

  it('recruiterIntent in this message → showCta true before the limit', () => {
    const outcome = quota.computeOutcome(STATE, { substantive: true, recruiterIntent: true });
    expect(outcome).toEqual({ remaining: 4, showCta: true });
  });

  it('recruiterIntent is sticky: an earlier one keeps showCta true', () => {
    expect(quota.computeOutcome({ ...STATE, anyRecruiter: true }, trivial).showCta).toBe(true);
  });

  it('lead captured → showCta always false', () => {
    const lead = { ...STATE, used: 5, anyRecruiter: true, leadCaptured: true };
    expect(quota.computeOutcome(lead, substantive).showCta).toBe(false);
    expect(quota.computeOutcome(lead, null).showCta).toBe(false);
  });

  it('fixed reply (current = null) → showCta = !leadCaptured, nothing new counts', () => {
    expect(quota.computeOutcome({ ...STATE, used: 5 }, null)).toEqual({
      remaining: 0,
      showCta: true,
    });
  });
});
