import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { completionBody, GROQ_ENDPOINT, installMockLlm } from './mock-llm.js';

// Guards the test infrastructure itself: if MockAgent stopped intercepting native fetch
// (e.g. an undici major that doesn't match Node's), every provider test would be meaningless.
describe('installMockLlm', () => {
  let llm: ReturnType<typeof installMockLlm>;

  beforeEach(() => {
    llm = installMockLlm();
  });

  afterEach(async () => {
    await llm.restore();
  });

  it('intercepts native fetch', async () => {
    llm.groq().reply(200, completionBody('{"ok":true}'));

    const response = await fetch(`${GROQ_ENDPOINT.origin}${GROQ_ENDPOINT.path}`, {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(completionBody('{"ok":true}'));
    llm.assertAllCalled();
  });

  it('blocks requests without an interceptor instead of hitting the network', async () => {
    await expect(fetch('https://api.groq.com/anything')).rejects.toThrow();
  });
});
