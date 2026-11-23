import type { ChatRepository } from './chat.repository.js';

/**
 * Business logic of the funnel: per-visitor daily limit, anti-abuse, global daily cap and
 * remaining/showCta. No HTTP, no LLM: it's tested with a fake repo and a fixed clock.
 * Rules: docs/CHAT-FLOW.md ("Reglas de conteo", "Tope diario global").
 */

export const CORDOBA_TZ = 'America/Argentina/Cordoba';

export interface QuotaConfig {
  queryLimit: number; // CHAT_QUERY_LIMIT
  hardMessageLimit: number; // CHAT_HARD_MESSAGE_LIMIT
  dailyGlobalLimit: number; // CHAT_DAILY_GLOBAL_LIMIT
}

/** Step 2 of the algorithm: everything derived from the DB, BEFORE this message. */
export interface VisitorQuotaState {
  used: number; // substantive USER messages today
  totalUser: number; // every USER message today
  anyRecruiter: boolean; // sticky recruiterIntent
  leadCaptured: boolean;
}

export type LimitReason = 'QUERY_LIMIT' | 'ABUSE_LIMIT' | 'GLOBAL_LIMIT';

export interface QuotaOutcome {
  remaining: number;
  showCta: boolean;
}

export interface QuotaService {
  getVisitorState(visitorId: string): Promise<VisitorQuotaState>;
  /** Step 3: the limit that blocks this message, or null if the LLM may be called. */
  checkLimits(state: VisitorQuotaState): LimitReason | null;
  /** Step 5: one more request reached the LLM (in-memory counter, resets at Córdoba midnight). */
  registerLlmCall(): void;
  /**
   * Step 8. `current` = the LLM classification of this message, or null for a fixed reply
   * (limits / LLM_UNAVAILABLE), where nothing new counts.
   */
  computeOutcome(
    state: VisitorQuotaState,
    current: { substantive: boolean; recruiterIntent: boolean } | null,
  ): QuotaOutcome;
}

export interface QuotaServiceDeps {
  repo: Pick<ChatRepository, 'countVisitorMessagesSince' | 'hasRecruiterIntent' | 'hasLead'>;
  config: QuotaConfig;
  /** Injectable clock: tests move "today" without fake timers. */
  now?: () => Date;
}

// hourCycle h23: midnight is "00", not "24".
const cordobaClock = new Intl.DateTimeFormat('en-US', {
  timeZone: CORDOBA_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Date and time a wall clock in Córdoba shows at `date`. */
function cordobaWallClock(date: Date) {
  const parts: Record<string, number> = {};
  for (const { type, value } of cordobaClock.formatToParts(date)) {
    parts[type] = Number(value);
  }
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

/**
 * 00:00 of `date`'s day in America/Argentina/Cordoba, as an absolute instant.
 * The offset isn't hardcoded (Argentina is UTC-3 today, but that has changed before):
 * it's measured by comparing Córdoba's wall clock with the real instant.
 */
export function startOfDayInCordoba(date: Date): Date {
  const clock = cordobaWallClock(date);
  const { year, month, day } = clock;

  // Wall clock read as if it were UTC, minus the real instant = Córdoba's offset (-3 h today).
  const wallClockAsUtc = Date.UTC(year, month - 1, day, clock.hour, clock.minute, clock.second);
  const offsetMs = wallClockAsUtc - Math.floor(date.getTime() / 1000) * 1000;

  return new Date(Date.UTC(year, month - 1, day) - offsetMs);
}

export function createQuotaService({
  repo,
  config,
  now = () => new Date(),
}: QuotaServiceDeps): QuotaService {
  // Global daily cap (ADR-012): lives in memory, single instance assumed.
  let globalDay = '';
  let globalCount = 0;

  /** The global counter for today, reset first if the Córdoba day changed. */
  function todaysGlobalCount(): number {
    const today = startOfDayInCordoba(now()).toISOString();
    if (today !== globalDay) {
      globalDay = today;
      globalCount = 0;
    }
    return globalCount;
  }

  return {
    async getVisitorState(visitorId) {
      const since = startOfDayInCordoba(now());
      const [counts, anyRecruiter, leadCaptured] = await Promise.all([
        repo.countVisitorMessagesSince(visitorId, since),
        repo.hasRecruiterIntent(visitorId),
        repo.hasLead(visitorId),
      ]);
      return {
        used: counts.substantiveUserMessages,
        totalUser: counts.totalUserMessages,
        anyRecruiter,
        leadCaptured,
      };
    },

    checkLimits(state) {
      if (state.used >= config.queryLimit) return 'QUERY_LIMIT';
      if (state.totalUser >= config.hardMessageLimit) return 'ABUSE_LIMIT';
      if (todaysGlobalCount() >= config.dailyGlobalLimit) return 'GLOBAL_LIMIT';
      return null;
    },

    registerLlmCall() {
      globalCount = todaysGlobalCount() + 1;
    },

    computeOutcome(state, current) {
      const usedNow = state.used + (current?.substantive ? 1 : 0);
      const remaining = Math.max(0, config.queryLimit - usedNow);

      // With a lead captured the CTA never shows again (CHAT-FLOW, rule 6).
      if (state.leadCaptured) return { remaining, showCta: false };
      // A fixed reply always comes with the CTA (ADR-011).
      if (current === null) return { remaining, showCta: true };

      const showCta = remaining === 0 || state.anyRecruiter || current.recruiterIntent;
      return { remaining, showCta };
    },
  };
}
