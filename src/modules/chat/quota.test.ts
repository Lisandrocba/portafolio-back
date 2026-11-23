import { describe, it } from 'vitest';

// Unit tests: fake repo (plain object implementing the 3 methods) + injected clock (`now`).

describe('startOfDayInCordoba', () => {
  it.todo('23:59 Córdoba (02:59 UTC next day) still belongs to the previous day');
  it.todo('00:00 Córdoba (03:00 UTC) starts a new day');
});

describe('quota.checkLimits', () => {
  it.todo('used = LIMIT - 1 → null (the query that exhausts the limit is answered)');
  it.todo('used = LIMIT → QUERY_LIMIT');
  it.todo('totalUser = HARD_LIMIT with few substantive → ABUSE_LIMIT');
  it.todo('global counter at the cap → GLOBAL_LIMIT');
  it.todo('global counter resets when the Córdoba day changes');
});

describe('quota.getVisitorState', () => {
  it.todo('counts only since the start of the Córdoba day (yesterday does not count)');
  it.todo('another visitorId has its own quota');
});

describe('quota.computeOutcome', () => {
  it.todo('substantive message decrements remaining; trivial does not');
  it.todo('remaining never goes below 0');
  it.todo('last query (remaining 0) → showCta true');
  it.todo('recruiterIntent in this message → showCta true before the limit');
  it.todo('recruiterIntent is sticky: an earlier one keeps showCta true');
  it.todo('lead captured → showCta always false');
  it.todo('fixed reply (current = null) → showCta = !leadCaptured');
});
