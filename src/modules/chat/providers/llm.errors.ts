import type { ProviderName } from './llm.types.js';

/**
 * Why a provider failed. All of them trigger failover to the next provider;
 * the kind is for logs and for tests to assert the right mapping.
 */
export type LlmFailureKind =
  | 'timeout' // AbortSignal.timeout fired
  | 'rate_limit' // HTTP 429 (free quota exhausted)
  | 'server' // HTTP 5xx
  | 'client' // other HTTP 4xx (bad key, bad model id...): a config bug, log as error
  | 'network' // fetch rejected (DNS, connection reset...)
  | 'bad_response'; // 2xx but the body doesn't have the expected shape

export class LlmProviderError extends Error {
  /** HTTP status when the failure came from a response. */
  readonly status: number | undefined;

  constructor(
    readonly provider: ProviderName,
    readonly kind: LlmFailureKind,
    message: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(`[${provider}] ${kind}: ${message}`, { cause: options?.cause });
    this.name = 'LlmProviderError';
    this.status = options?.status;
  }
}
