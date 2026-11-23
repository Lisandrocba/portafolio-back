import { getGlobalDispatcher, MockAgent, setGlobalDispatcher, type Dispatcher } from 'undici';
import {
  GEMINI_BASE_URL,
  GROQ_BASE_URL,
} from '../../src/modules/chat/providers/openai-compatible.provider.js';

/** Splits a provider base URL into what MockAgent needs: origin + chat completions path. */
function chatEndpoint(baseUrl: string) {
  const url = new URL(`${baseUrl}/chat/completions`);
  return { origin: url.origin, path: url.pathname };
}

export const GROQ_ENDPOINT = chatEndpoint(GROQ_BASE_URL);
export const GEMINI_ENDPOINT = chatEndpoint(GEMINI_BASE_URL);

// The openai SDK only parses the body as JSON when the response says so.
const JSON_HEADERS = { 'content-type': 'application/json' };

/**
 * Installs a MockAgent as the global dispatcher, so native `fetch` (and the openai SDK,
 * which uses it) goes through it. Real network is disabled: a request without an interceptor
 * fails the test instead of hitting a real API. Call `restore()` in afterEach.
 *
 *   const llm = installMockLlm();
 *   llm.groq().reply(429, {});
 *   llm.gemini().reply(200, completionBody('{"reply":"…"}'));
 *   …
 *   await llm.restore();
 */
export function installMockLlm() {
  const previous: Dispatcher = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);

  return {
    agent,
    groq: () =>
      agent
        .get(GROQ_ENDPOINT.origin)
        .intercept({ path: GROQ_ENDPOINT.path, method: 'POST' })
        .defaultReplyHeaders(JSON_HEADERS),
    gemini: () =>
      agent
        .get(GEMINI_ENDPOINT.origin)
        .intercept({ path: GEMINI_ENDPOINT.path, method: 'POST' })
        .defaultReplyHeaders(JSON_HEADERS),
    /** Fails if an interceptor was defined but never called (e.g. failover didn't happen). */
    assertAllCalled: () => {
      agent.assertNoPendingInterceptors();
    },
    restore: async () => {
      setGlobalDispatcher(previous);
      await agent.close();
    },
  };
}

/** Minimal successful chat completions body (Groq and Gemini share the OpenAI format). */
export function completionBody(content: string, totalTokens = 42) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model: 'test-model',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 30, completion_tokens: 12, total_tokens: totalTokens },
  };
}

/** What the LLM is asked to answer in JSON mode (LlmOutputSchema), as a string. */
export function llmJson(reply: string, substantive = true, recruiterIntent = false) {
  return JSON.stringify({ reply, substantive, recruiterIntent });
}
