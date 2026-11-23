import { notImplemented } from '../../lib/not-implemented.js';
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

/**
 * 00:00 of `date`'s day in America/Argentina/Cordoba, as an absolute instant.
 *
 * TODO(fase 4): Argentina is UTC-3 with no DST today, but don't hardcode the offset:
 * get the local Y/M/D with Intl.DateTimeFormat(…, { timeZone: CORDOBA_TZ }) and build the instant.
 * Edge cases to test: 23:59 and 00:00 Córdoba time (= 02:59 / 03:00 UTC).
 */
export function startOfDayInCordoba(_date: Date): Date {
  return notImplemented('startOfDayInCordoba');
}

/**
 * TODO(fase 4):
 *  - getVisitorState: Promise.all over the repo (counts since startOfDayInCordoba(now()),
 *    hasRecruiterIntent, hasLead).
 *  - checkLimits, in this order: used >= queryLimit → QUERY_LIMIT;
 *    totalUser >= hardMessageLimit → ABUSE_LIMIT; global counter >= dailyGlobalLimit → GLOBAL_LIMIT.
 *  - Global counter: { day: string; count: number } in this closure. If the Córdoba day
 *    changed since the last call, reset it. Single instance assumed (ADR-012).
 *  - computeOutcome:
 *      usedNow   = used + (current?.substantive ? 1 : 0)
 *      remaining = max(0, queryLimit - usedNow)
 *      showCta   = !leadCaptured && (current === null || remaining === 0
 *                                    || anyRecruiter || current.recruiterIntent)
 */
export function createQuotaService(_deps: QuotaServiceDeps): QuotaService {
  return {
    getVisitorState: async () => notImplemented('quota.getVisitorState'),
    checkLimits: () => notImplemented('quota.checkLimits'),
    registerLlmCall: () => notImplemented('quota.registerLlmCall'),
    computeOutcome: () => notImplemented('quota.computeOutcome'),
  };
}
