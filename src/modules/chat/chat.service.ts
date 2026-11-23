import type { FastifyBaseLogger } from 'fastify';
import { notImplemented } from '../../lib/not-implemented.js';
import type { ChatRepository } from './chat.repository.js';
import type { ChatRequest, ChatResponse, Contact } from './chat.schemas.js';
import type { LlmProvider } from './providers/llm.types.js';
import type { QuotaService } from './quota.service.js';

/** What the route hands to the service: the validated body + request metadata. */
export interface ChatInput extends ChatRequest {
  ip: string;
  userAgent: string | null;
  referrer: string | null;
}

export interface ChatService {
  handle(input: ChatInput): Promise<ChatResponse>;
}

export interface ChatServiceDeps {
  repo: ChatRepository;
  quota: QuotaService;
  /** Ordered: [groq, gemini]. The first one that answers wins (ADR-004). */
  providers: LlmProvider[];
  /** CV context already formatted (CV services → formatProfileContext). Read on every request. */
  loadProfileContext: () => Promise<string>;
  /** email + linkedinUrl from Profile; phone only when `includePhone` (lead captured, ADR-021). */
  getContact: (includePhone: boolean) => Promise<Contact>;
  hashIp: (ip: string) => string;
  config: { historyWindow: number };
  log: FastifyBaseLogger;
}

/**
 * Orchestrates one chat turn. Algorithm: docs/CHAT-FLOW.md#algoritmo-de-chatservicehandle
 *
 * TODO(fase 4), step by step:
 *  1. visitorId ?? randomUUID(). conversationId exists (repo.findConversationId)? use it :
 *     repo.createConversation({ visitorId, ipHash: hashIp(ip), userAgent, referrer } truncated).
 *     repo.touchConversation.
 *  2. state = await quota.getVisitorState(visitorId); contact = getContact(state.leadCaptured).
 *  3. limit = quota.checkLimits(state). If limit → fixed reply (chat.replies.ts; with lead
 *     captured use LEAD_CAPTURED_REPLY), save USER(substantive=false) + ASSISTANT(provider=null),
 *     return with quota.computeOutcome(state, null).
 *  4. system = buildSystemPrompt(await loadProfileContext());
 *     messages = [...repo.getHistory(conversationId, historyWindow), { role: 'user', content }].
 *  5. for (const provider of providers) try { result = await provider.complete(...); break }
 *     catch (err) { log.warn({ err, provider: provider.name }) }. quota.registerLlmCall().
 *     None answered → reason LLM_UNAVAILABLE, same treatment as step 3 (log.error).
 *  6. LlmOutputSchema.safeParse(JSON.parse(result.text)) — JSON.parse can throw, catch it.
 *     Invalid → { reply: result.text, substantive: true, recruiterIntent: false }.
 *  7. repo.saveExchange(conversationId, USER{...}, ASSISTANT{ provider, tokensUsed }).
 *  8. { remaining, showCta } = quota.computeOutcome(state, output); reason 'OK'.
 *  Message content is logged at `debug` level only.
 */
export function createChatService(_deps: ChatServiceDeps): ChatService {
  return {
    handle: async () => notImplemented('chat.service handle()'),
  };
}
