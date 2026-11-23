import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { completionBody, installMockLlm } from '../../../../test/helpers/mock-llm.js';
import { LlmProviderError } from './llm.errors.js';
import type { LlmRequest } from './llm.types.js';
import {
  GEMINI_BASE_URL,
  GROQ_BASE_URL,
  OpenAiCompatibleProvider,
} from './openai-compatible.provider.js';

// MockAgent intercepts the fetch the openai SDK uses. No test hits a real API.

const CONFIG = { apiKey: 'test-key', model: 'test-model', timeoutMs: 1000 };
const REQUEST: LlmRequest = {
  system: 'Respond in JSON',
  messages: [
    { role: 'user', content: 'hola' },
    { role: 'assistant', content: '{"reply":"hola"}' },
    { role: 'user', content: '¿Sabe React?' },
  ],
};

/** Runs `complete` expecting a rejection and returns the LlmProviderError. */
async function failure(provider: OpenAiCompatibleProvider): Promise<LlmProviderError> {
  const error: unknown = await provider.complete(REQUEST).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(LlmProviderError);
  return error as LlmProviderError;
}

describe('OpenAiCompatibleProvider', () => {
  let llm: ReturnType<typeof installMockLlm>;
  const groq = new OpenAiCompatibleProvider('groq', GROQ_BASE_URL, CONFIG);

  beforeEach(() => {
    llm = installMockLlm();
  });

  afterEach(async () => {
    await llm.restore();
  });

  it('sends system + messages, model, JSON mode and the key as Bearer', async () => {
    let sentBody: unknown;
    let sentHeaders: Record<string, string> = {};
    llm.groq().reply(200, (opts) => {
      sentBody = JSON.parse(opts.body as string);
      sentHeaders = opts.headers as Record<string, string>;
      return completionBody('{}');
    });

    await groq.complete(REQUEST);

    expect(sentBody).toMatchObject({
      model: 'test-model',
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: 'Respond in JSON' }, ...REQUEST.messages],
    });
    expect(sentHeaders.authorization).toBe('Bearer test-key');
  });

  it('maps choices[0].message.content and usage.total_tokens to LlmResult', async () => {
    llm.groq().reply(200, completionBody('{"reply":"Sí"}', 99));

    await expect(groq.complete(REQUEST)).resolves.toEqual({
      provider: 'groq',
      text: '{"reply":"Sí"}',
      tokensUsed: 99,
    });
  });

  it('returns tokensUsed null when the provider does not report usage', async () => {
    const { usage: _omitted, ...body } = completionBody('{}');
    llm.groq().reply(200, body);

    await expect(groq.complete(REQUEST)).resolves.toMatchObject({ tokensUsed: null });
  });

  it('rejects with rate_limit on 429', async () => {
    llm.groq().reply(429, { error: { message: 'quota' } });

    const error = await failure(groq);

    expect(error.kind).toBe('rate_limit');
    expect(error.status).toBe(429);
  });

  it('rejects with server on 5xx', async () => {
    llm.groq().reply(503, { error: { message: 'down' } });

    expect((await failure(groq)).kind).toBe('server');
  });

  it.each([400, 401, 404])('rejects with client on %i (bad key or model)', async (status) => {
    llm.groq().reply(status, { error: { message: 'bad' } });

    expect((await failure(groq)).kind).toBe('client');
  });

  it('rejects with timeout when the response takes longer than timeoutMs', async () => {
    const fast = new OpenAiCompatibleProvider('groq', GROQ_BASE_URL, { ...CONFIG, timeoutMs: 50 });
    llm.groq().reply(200, completionBody('{}')).delay(500);

    expect((await failure(fast)).kind).toBe('timeout');
  });

  it('rejects with network when the connection fails', async () => {
    llm.groq().replyWithError(new Error('ECONNRESET'));

    expect((await failure(groq)).kind).toBe('network');
  });

  it('rejects with bad_response when the body has no content', async () => {
    llm.groq().reply(200, completionBody(''));

    expect((await failure(groq)).kind).toBe('bad_response');
  });

  it('talks to Gemini through its OpenAI-compatible endpoint, key in a header', async () => {
    const gemini = new OpenAiCompatibleProvider('gemini', GEMINI_BASE_URL, CONFIG);
    let sentHeaders: Record<string, string> = {};
    llm.gemini().reply(200, (opts) => {
      sentHeaders = opts.headers as Record<string, string>;
      return completionBody('{"reply":"Sí"}');
    });

    await expect(gemini.complete(REQUEST)).resolves.toMatchObject({ provider: 'gemini' });
    // The intercepted path has no query string: `?key=` would have failed to match (rule 10).
    expect(sentHeaders.authorization).toBe('Bearer test-key');
    llm.assertAllCalled();
  });
});
