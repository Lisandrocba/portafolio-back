import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai';
import type { Env } from '../../../config/env.js';
import { LlmProviderError } from './llm.errors.js';
import type {
  LlmProvider,
  LlmProviderConfig,
  LlmRequest,
  LlmResult,
  ProviderName,
} from './llm.types.js';

// Both providers speak the OpenAI chat completions API: only the base URL changes.
// Gemini's key travels as `Authorization: Bearer`, never as `?key=` (rule 10).
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

/** Low temperature: the bot answers from the CV, creativity only hurts. */
const TEMPERATURE = 0.3;

export class OpenAiCompatibleProvider implements LlmProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    readonly name: ProviderName,
    baseURL: string,
    { apiKey, model, timeoutMs }: LlmProviderConfig,
  ) {
    this.model = model;
    // maxRetries: 0 → failover to the next provider is chat.service's job, not the SDK's.
    this.client = new OpenAI({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 0 });
  }

  async complete({ system, messages }: LlmRequest): Promise<LlmResult> {
    let res: OpenAI.Chat.ChatCompletion;
    try {
      res = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'system', content: system }, ...messages],
        // JSON mode: the model must answer { reply, substantive, recruiterIntent } (ADR-010).
        response_format: { type: 'json_object' },
        temperature: TEMPERATURE,
      });
    } catch (error) {
      throw this.toProviderError(error);
    }

    const text = res.choices[0]?.message.content;
    if (!text) {
      throw new LlmProviderError(this.name, 'bad_response', 'response without content');
    }

    return {
      provider: this.name,
      text,
      tokensUsed: res.usage?.total_tokens ?? null,
    };
  }

  /** Translates the SDK errors into the kinds chat.service logs (llm.errors.ts). */
  private toProviderError(error: unknown): LlmProviderError {
    // Order matters: the timeout error is a subclass of the connection error,
    // and both are subclasses of APIError.
    if (error instanceof APIConnectionTimeoutError) {
      return new LlmProviderError(this.name, 'timeout', 'request timed out', { cause: error });
    }
    if (error instanceof APIConnectionError) {
      return new LlmProviderError(this.name, 'network', error.message, { cause: error });
    }
    // The SDK types `status` loosely: narrow it to a number before using it.
    if (error instanceof APIError && typeof error.status === 'number') {
      const status: number = error.status;
      const kind = status === 429 ? 'rate_limit' : status >= 500 ? 'server' : 'client';
      return new LlmProviderError(this.name, kind, `HTTP ${String(status)}`, {
        cause: error,
        status,
      });
    }
    return new LlmProviderError(this.name, 'network', 'unexpected error', { cause: error });
  }
}

/** The failover order (ADR-004): Groq first, Gemini only if both of its variables are set. */
export function createLlmProviders(config: Env): LlmProvider[] {
  const timeoutMs = config.LLM_TIMEOUT_MS;
  const providers: LlmProvider[] = [
    new OpenAiCompatibleProvider('groq', GROQ_BASE_URL, {
      apiKey: config.GROQ_API_KEY,
      model: config.GROQ_MODEL,
      timeoutMs,
    }),
  ];

  if (config.GEMINI_API_KEY && config.GEMINI_MODEL) {
    providers.push(
      new OpenAiCompatibleProvider('gemini', GEMINI_BASE_URL, {
        apiKey: config.GEMINI_API_KEY,
        model: config.GEMINI_MODEL,
        timeoutMs,
      }),
    );
  }
  return providers;
}
