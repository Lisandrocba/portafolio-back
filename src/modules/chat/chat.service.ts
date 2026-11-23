import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { buildSystemPrompt } from './prompt/system-prompt.js';
import {
  detectLanguage,
  FIXED_REPLIES,
  LEAD_CAPTURED_REPLY,
  type FixedReason,
} from './chat.replies.js';
import type { ChatRepository } from './chat.repository.js';
import {
  LlmOutputSchema,
  type ChatRequest,
  type ChatResponse,
  type Contact,
  type LlmOutput,
} from './chat.schemas.js';
import { LlmProviderError } from './providers/llm.errors.js';
import type { LlmProvider, LlmRequest, LlmResult } from './providers/llm.types.js';
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
  /** Only warn and error are used: tests pass two vi.fn(). */
  log: Pick<FastifyBaseLogger, 'warn' | 'error'>;
}

/** userAgent and referrer are stored truncated (CHAT-FLOW, "Privacidad"). */
const MAX_HEADER_CHARS = 512;

function truncate(value: string | null): string | null {
  return value === null ? null : value.slice(0, MAX_HEADER_CHARS);
}

/**
 * Step 6: the LLM was asked for JSON, but it may not comply. If the answer doesn't parse,
 * the raw text is shown and the message counts as substantive (ADR-010: better to show the
 * CTA early than to give quota away).
 */
export function parseLlmOutput(text: string): LlmOutput {
  try {
    const parsed = LlmOutputSchema.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
  } catch {
    // Not JSON at all: same fallback as a JSON with the wrong shape.
  }
  return { reply: text, substantive: true, recruiterIntent: false };
}

/**
 * Orchestrates one chat turn. Algorithm (steps 1–8): docs/CHAT-FLOW.md#algoritmo-de-chatservicehandle
 */
export function createChatService(deps: ChatServiceDeps): ChatService {
  const { repo, quota, providers, log } = deps;

  /** Step 1: the conversation the client sent if it exists, otherwise a new one. Never 404. */
  async function resolveConversation(input: ChatInput, visitorId: string): Promise<string> {
    const existingId = input.conversationId
      ? await repo.findConversationId(input.conversationId)
      : null;

    if (existingId) {
      await repo.touchConversation(existingId);
      return existingId;
    }

    const created = await repo.createConversation({
      visitorId,
      ipHash: deps.hashIp(input.ip),
      userAgent: truncate(input.userAgent),
      referrer: truncate(input.referrer),
    });
    return created.id;
  }

  /** Step 5: tries each provider in order. null = all of them failed. */
  async function askLlm(request: LlmRequest): Promise<LlmResult | null> {
    for (const provider of providers) {
      try {
        return await provider.complete(request);
      } catch (err) {
        // 'client' (bad key, bad model id) is a config bug, not a hiccup: log it louder.
        const isConfigBug = err instanceof LlmProviderError && err.kind === 'client';
        log[isConfigBug ? 'error' : 'warn'](
          { err, provider: provider.name },
          'llm provider failed',
        );
      }
    }
    return null;
  }

  return {
    async handle(input) {
      // 1. Visitor and conversation
      const visitorId = input.visitorId ?? randomUUID();
      const conversationId = await resolveConversation(input, visitorId);

      // 2. State BEFORE this message, all derived from the DB
      const state = await quota.getVisitorState(visitorId);
      const contact = await deps.getContact(state.leadCaptured);

      /** Steps 3 and 5 when the LLM can't (or must not) answer: fixed text + CTA. */
      const fixedReply = async (reason: FixedReason): Promise<ChatResponse> => {
        const language = detectLanguage(input.message);
        const reply = state.leadCaptured
          ? LEAD_CAPTURED_REPLY[language]
          : FIXED_REPLIES[reason][language];

        await repo.saveExchange(
          conversationId,
          { content: input.message, substantive: false, recruiterIntent: false },
          { content: reply, provider: null, tokensUsed: null },
        );
        return {
          visitorId,
          conversationId,
          reply,
          reason,
          contact,
          ...quota.computeOutcome(state, null),
        };
      };

      // 3. Limits are checked before calling the LLM
      const limit = quota.checkLimits(state);
      if (limit) {
        log.warn({ visitorId, reason: limit }, 'chat limit reached');
        return fixedReply(limit);
      }

      // 4. Prompt: fixed rules + CV in the system message, history + the new message after it
      const history = await repo.getHistory(conversationId, deps.config.historyWindow);
      const request: LlmRequest = {
        system: buildSystemPrompt(await deps.loadProfileContext()),
        messages: [
          ...history.map((m) => ({
            role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          })),
          { role: 'user', content: input.message },
        ],
      };

      // 5. Failover across providers
      const result = await askLlm(request);
      quota.registerLlmCall();
      if (!result) {
        log.error({ visitorId }, 'every llm provider failed');
        return fixedReply('LLM_UNAVAILABLE');
      }

      // 6. Parse the JSON the model returned
      const output = parseLlmOutput(result.text);

      // 7. Persist USER + ASSISTANT together
      await repo.saveExchange(
        conversationId,
        {
          content: input.message,
          substantive: output.substantive,
          recruiterIntent: output.recruiterIntent,
        },
        { content: output.reply, provider: result.provider, tokensUsed: result.tokensUsed },
      );

      // 8. remaining and showCta, counting this message
      return {
        visitorId,
        conversationId,
        reply: output.reply,
        reason: 'OK',
        contact,
        ...quota.computeOutcome(state, output),
      };
    },
  };
}
