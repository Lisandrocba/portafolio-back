import { getGlobalDispatcher, MockAgent, setGlobalDispatcher, type Dispatcher } from 'undici';
import {
  GEMINI_ORIGIN,
  geminiGeneratePath,
} from '../../src/modules/chat/providers/gemini.provider.js';
import { GROQ_CHAT_PATH, GROQ_ORIGIN } from '../../src/modules/chat/providers/groq.provider.js';

/**
 * Installs a MockAgent as the global dispatcher, so native `fetch` goes through it.
 * Real network is disabled: a request without an interceptor fails the test instead of
 * hitting a real API. Call `restore()` in afterEach.
 *
 *   const llm = installMockLlm();
 *   llm.groq().reply(429, {});
 *   llm.gemini('test-gemini-model').reply(200, geminiBody('{"reply":"…"}'));
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
    groq: () => agent.get(GROQ_ORIGIN).intercept({ path: GROQ_CHAT_PATH, method: 'POST' }),
    gemini: (model: string) =>
      agent.get(GEMINI_ORIGIN).intercept({ path: geminiGeneratePath(model), method: 'POST' }),
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

/** Minimal successful Groq (OpenAI-compatible) body. */
export function groqBody(content: string, totalTokens = 42) {
  return {
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { total_tokens: totalTokens },
  };
}

/** Minimal successful Gemini generateContent body. */
export function geminiBody(text: string, totalTokens = 42) {
  return {
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
    usageMetadata: { totalTokenCount: totalTokens },
  };
}
