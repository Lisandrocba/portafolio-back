/**
 * Contract shared by every LLM provider (ADR-004). chat.service only knows this interface:
 * adding a provider = one file implementing LlmProvider + adding it to the array.
 */

export type ProviderName = 'groq' | 'gemini';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  /** System prompt: fixed rules + CV context. Visitor text never goes here. */
  system: string;
  /** Conversation history (CHAT_HISTORY_WINDOW) followed by the current user message. */
  messages: LlmMessage[];
}

export interface LlmResult {
  provider: ProviderName;
  /**
   * Raw text as returned by the model (expected to be JSON, but not parsed here).
   * Parsing with LlmOutputSchema happens in chat.service, so a malformed answer can still be shown.
   */
  text: string;
  /** Total tokens if the provider reports them, otherwise null. */
  tokensUsed: number | null;
}

export interface LlmProvider {
  readonly name: ProviderName;
  /**
   * Resolves with the model's answer or rejects with LlmProviderError.
   * Must enforce its own timeout (LLM_TIMEOUT_MS) so the failover loop never hangs.
   */
  complete(request: LlmRequest): Promise<LlmResult>;
}

/** Settings each provider factory receives (built from app.config in buildApp). */
export interface LlmProviderConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}
