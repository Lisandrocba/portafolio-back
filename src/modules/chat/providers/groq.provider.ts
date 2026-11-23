import { notImplemented } from '../../../lib/not-implemented.js';
import type { LlmProvider, LlmProviderConfig, LlmRequest, LlmResult } from './llm.types.js';

// Exported so tests (MockAgent) intercept exactly what the provider calls.
export const GROQ_ORIGIN = 'https://api.groq.com';
export const GROQ_CHAT_PATH = '/openai/v1/chat/completions';

/**
 * Groq: OpenAI-compatible chat completions API, called with native fetch (no SDK).
 *
 * TODO(fase 4) implement `complete`:
 *  1. POST `${GROQ_ORIGIN}${GROQ_CHAT_PATH}`
 *     headers: `authorization: Bearer <apiKey>`, `content-type: application/json`
 *     body: { model, messages: [{ role: 'system', content: system }, ...messages],
 *             response_format: { type: 'json_object' }, temperature: low (0.2–0.4) }
 *     signal: AbortSignal.timeout(timeoutMs)
 *  2. Map failures to LlmProviderError (llm.errors.ts):
 *     TimeoutError → 'timeout' · 429 → 'rate_limit' · 5xx → 'server' · other 4xx → 'client'
 *     fetch rejected → 'network'
 *  3. Parse the body with a small Zod schema (never trust the shape):
 *     choices[0].message.content → text · usage.total_tokens → tokensUsed
 *     missing content → 'bad_response'
 *  4. Return { provider: 'groq', text, tokensUsed }.
 *  Never log the api key or the request headers (they're redacted, but don't rely on it).
 */
export function createGroqProvider(_config: LlmProviderConfig): LlmProvider {
  return {
    name: 'groq',
    async complete(_request: LlmRequest): Promise<LlmResult> {
      return notImplemented('groq.provider complete()');
    },
  };
}
