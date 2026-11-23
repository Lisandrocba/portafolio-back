import { notImplemented } from '../../../lib/not-implemented.js';
import type { LlmProvider, LlmProviderConfig, LlmRequest, LlmResult } from './llm.types.js';

export const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com';
export const geminiGeneratePath = (model: string) => `/v1beta/models/${model}:generateContent`;

/**
 * Gemini (Flash-Lite), fallback provider, called with native fetch (no SDK).
 *
 * TODO(fase 4) implement `complete`:
 *  1. POST `${GEMINI_ORIGIN}${geminiGeneratePath(model)}`
 *     headers: `x-goog-api-key: <apiKey>` (NEVER `?key=` in the URL: it ends up in logs, rule 10)
 *     body: { systemInstruction: { parts: [{ text: system }] },
 *             contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user',
 *                                            parts: [{ text: m.content }] })),
 *             generationConfig: { responseMimeType: 'application/json', temperature } }
 *     signal: AbortSignal.timeout(timeoutMs)
 *  2. Same error mapping as Groq (llm.errors.ts).
 *  3. Parse with Zod: candidates[0].content.parts[0].text → text
 *     usageMetadata.totalTokenCount → tokensUsed · no candidates (e.g. safety block) → 'bad_response'
 *  4. Return { provider: 'gemini', text, tokensUsed }.
 */
export function createGeminiProvider(_config: LlmProviderConfig): LlmProvider {
  return {
    name: 'gemini',
    async complete(_request: LlmRequest): Promise<LlmResult> {
      return notImplemented('gemini.provider complete()');
    },
  };
}
