import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from '../../../test/helpers/build-app.js';
import { resetDatabase } from '../../../test/helpers/database.js';
import { completionBody, installMockLlm, llmJson } from '../../../test/helpers/mock-llm.js';
import type { App } from '../../lib/types.js';
import { createInMemoryChatRepository } from '../../../test/helpers/memory-chat-repository.js';
import { FIXED_REPLIES, LEAD_CAPTURED_REPLY } from './chat.replies.js';
import type { ChatRepository } from './chat.repository.js';
import type { ChatResponse } from './chat.schemas.js';
import { createChatService, parseLlmOutput, type ChatInput } from './chat.service.js';
import { LlmProviderError } from './providers/llm.errors.js';
import type { LlmProvider, LlmRequest } from './providers/llm.types.js';
import { createQuotaService } from './quota.service.js';

// POST /chat end to end: app.inject() + the test database + MockAgent for the LLM.
// The funnel cases that need a lead (not creatable over HTTP until fase 5) test the service
// with the in-memory repository.

const VISITOR_ID = '9b2d4f7a-1c3e-4e5f-8a6b-7c8d9e0f1a2b';

describe('POST /chat', () => {
  let app: App;
  let llm: ReturnType<typeof installMockLlm>;

  beforeEach(async () => {
    llm = installMockLlm();
    app = await buildTestApp();
    await resetDatabase(app.prisma);
  });

  afterEach(async () => {
    await app.close();
    await llm.restore();
  });

  const send = (body: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/chat', payload: body });

  describe('contract', () => {
    it('400 when message is empty or longer than CHAT_MAX_MESSAGE_CHARS', async () => {
      expect((await send({ message: '   ' })).statusCode).toBe(400);
      expect((await send({ message: 'a'.repeat(501) })).statusCode).toBe(400);
    });

    it('400 when visitorId is not a UUID', async () => {
      expect((await send({ visitorId: 'not-a-uuid', message: 'hola' })).statusCode).toBe(400);
    });

    it('without visitorId → generates one and returns it', async () => {
      llm.groq().reply(200, completionBody(llmJson('¡Hola!', false)));

      const response = await send({ message: 'hola' });

      expect(response.statusCode).toBe(200);
      expect(response.json<ChatResponse>().visitorId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('unknown conversationId → creates a new conversation, never 404', async () => {
      llm.groq().reply(200, completionBody(llmJson('¡Hola!', false)));
      const unknown = randomUUID();

      const response = await send({ conversationId: unknown, message: 'hola' });

      expect(response.statusCode).toBe(200);
      expect(response.json<ChatResponse>().conversationId).not.toBe(unknown);
    });

    it('keeps the conversation and sends its history to the LLM', async () => {
      const sentMessages: unknown[] = [];
      llm
        .groq()
        .reply(200, (opts) => {
          sentMessages.push(JSON.parse(opts.body as string));
          return completionBody(llmJson('Respuesta'));
        })
        .times(2);

      const first = (
        await send({ visitorId: VISITOR_ID, message: 'primera' })
      ).json<ChatResponse>();
      const second = (
        await send({
          visitorId: VISITOR_ID,
          conversationId: first.conversationId,
          message: 'segunda',
        })
      ).json<ChatResponse>();

      expect(second.conversationId).toBe(first.conversationId);
      expect(sentMessages[1]).toMatchObject({
        messages: [
          { role: 'system' },
          { role: 'user', content: 'primera' },
          { role: 'assistant', content: 'Respuesta' },
          { role: 'user', content: 'segunda' },
        ],
      });
    });

    it('response never includes fields outside ChatResponseSchema', async () => {
      llm.groq().reply(200, completionBody(llmJson('Sí, usó React.')));

      const response = await send({ visitorId: VISITOR_ID, message: '¿Sabe React?' });

      expect(Object.keys(response.json<ChatResponse>()).sort()).toEqual(
        [
          'contact',
          'conversationId',
          'reason',
          'remaining',
          'reply',
          'showCta',
          'visitorId',
        ].sort(),
      );
      expect(response.json<ChatResponse>()).toMatchObject({
        visitorId: VISITOR_ID,
        reply: 'Sí, usó React.',
        remaining: 4,
        showCta: false,
        reason: 'OK',
        contact: { phone: null },
      });
    });
  });

  describe('failover', () => {
    it('groq 429 → gemini answers', async () => {
      llm.groq().reply(429, { error: { message: 'quota' } });
      llm.gemini().reply(200, completionBody(llmJson('Desde Gemini')));

      const response = await send({ message: '¿Sabe React?' });

      expect(response.json<ChatResponse>()).toMatchObject({ reply: 'Desde Gemini', reason: 'OK' });
      llm.assertAllCalled();
    });

    it('both fail → 200 with reason LLM_UNAVAILABLE and showCta true', async () => {
      llm.groq().reply(503, {});
      llm.gemini().replyWithError(new Error('ECONNRESET'));

      const response = await send({ message: '¿Sabe React?' });

      expect(response.statusCode).toBe(200);
      expect(response.json<ChatResponse>()).toMatchObject({
        reply: FIXED_REPLIES.LLM_UNAVAILABLE.es,
        reason: 'LLM_UNAVAILABLE',
        showCta: true,
        remaining: 5,
      });
    });

    it('without GEMINI_API_KEY only groq is tried', async () => {
      const groqOnly = await buildTestApp({ GEMINI_API_KEY: undefined });
      try {
        llm.groq().reply(429, {});
        // If Gemini were tried it would answer, and reason would be OK.
        llm.gemini().reply(200, completionBody(llmJson('Desde Gemini')));

        const response = await groqOnly.inject({
          method: 'POST',
          url: '/chat',
          payload: { message: '¿Sabe React?' },
        });

        expect(response.json<ChatResponse>().reason).toBe('LLM_UNAVAILABLE');
      } finally {
        await groqOnly.close();
      }
    });
  });

  describe('LLM output', () => {
    it('trivial message → does not use quota', async () => {
      llm.groq().reply(200, completionBody(llmJson('¡Hola!', false)));

      const response = await send({ message: 'hola' });

      expect(response.json<ChatResponse>().remaining).toBe(5);
    });

    it('recruiterIntent → showCta true before the limit', async () => {
      llm.groq().reply(200, completionBody(llmJson('Te paso el contacto', true, true)));

      const response = await send({ message: 'Tenemos una vacante, ¿está disponible?' });

      expect(response.json<ChatResponse>()).toMatchObject({ remaining: 4, showCta: true });
    });

    it('invalid JSON → raw text as reply, counted as substantive', async () => {
      llm.groq().reply(200, completionBody('Texto sin JSON'));

      const response = await send({ message: 'hola' });

      expect(response.json<ChatResponse>()).toMatchObject({
        reply: 'Texto sin JSON',
        remaining: 4,
      });
    });
  });

  describe('funnel', () => {
    it('at QUERY_LIMIT → fixed reply without calling the LLM', async () => {
      llm
        .groq()
        .reply(200, completionBody(llmJson('Respuesta')))
        .times(5);

      const replies: ChatResponse[] = [];
      for (let i = 0; i < 6; i++) {
        const response = await send({ visitorId: VISITOR_ID, message: `pregunta ${String(i)}` });
        replies.push(response.json<ChatResponse>());
      }

      // The 5th query is answered in full, with the CTA under it.
      expect(replies[4]).toMatchObject({ reason: 'OK', remaining: 0, showCta: true });
      // The 6th never reaches the LLM (a 6th call would have no interceptor).
      expect(replies[5]).toMatchObject({
        reason: 'QUERY_LIMIT',
        reply: FIXED_REPLIES.QUERY_LIMIT.es,
        remaining: 0,
        showCta: true,
      });
      llm.assertAllCalled();
    });

    it('rate limit: 11th request in a minute → 429', async () => {
      llm
        .groq()
        .reply(200, completionBody(llmJson('Respuesta', false)))
        .persist();

      for (let i = 0; i < 10; i++) {
        expect((await send({ message: 'hola' })).statusCode).toBe(200);
      }
      expect((await send({ message: 'hola' })).statusCode).toBe(429);
    });
  });
});

describe('chat.service', () => {
  const CONTACT = { email: 'test@example.com', linkedinUrl: 'https://example.com/in/test' };
  const FAKE_PHONE = '+54 9 000 000-0000';

  const INPUT: ChatInput = {
    visitorId: VISITOR_ID,
    message: '¿Sabe React?',
    ip: '203.0.113.7',
    userAgent: 'x'.repeat(600),
    referrer: null,
  };

  /** Provider that always answers `text` and records what it received. */
  function fakeProvider(text: string): LlmProvider & { requests: LlmRequest[] } {
    const requests: LlmRequest[] = [];
    return {
      name: 'groq',
      requests,
      async complete(request) {
        requests.push(request);
        return { provider: 'groq', text, tokensUsed: 10 };
      },
    };
  }

  function setup(options: { repo?: ChatRepository; providers?: LlmProvider[] } = {}) {
    const memory = createInMemoryChatRepository();
    const repo = options.repo ?? memory;
    const service = createChatService({
      repo,
      quota: createQuotaService({
        repo,
        config: { queryLimit: 5, hardMessageLimit: 20, dailyGlobalLimit: 300 },
      }),
      providers: options.providers ?? [fakeProvider(llmJson('Sí, usó React.'))],
      loadProfileContext: async () => 'PERFIL\nDatos de prueba',
      getContact: async (includePhone) => ({ ...CONTACT, phone: includePhone ? FAKE_PHONE : null }),
      hashIp: (ip) => `hashed:${ip}`,
      config: { historyWindow: 10 },
      log: { warn: vi.fn(), error: vi.fn() },
    });
    return { service, memory };
  }

  /** In-memory repo where the visitor already left a lead. */
  function repoWithLead(usedQueries: number): ChatRepository {
    const repo = createInMemoryChatRepository();
    return {
      ...repo,
      hasLead: async () => true,
      countVisitorMessagesSince: async () => ({
        substantiveUserMessages: usedQueries,
        totalUserMessages: usedQueries,
      }),
    };
  }

  it('stores the ipHash, never the ip in clear, and truncates the user agent', async () => {
    const { service, memory } = setup();

    const response = await service.handle(INPUT);

    const stored = memory.conversations.get(response.conversationId);
    expect(stored).toMatchObject({ visitorId: VISITOR_ID, ipHash: 'hashed:203.0.113.7' });
    expect(JSON.stringify(stored)).not.toContain('"203.0.113.7"');
    expect(stored?.userAgent).toHaveLength(512);
  });

  it('puts the CV in the system prompt and the visitor text only in a user message', async () => {
    const provider = fakeProvider(llmJson('Sí'));
    const { service } = setup({ providers: [provider] });

    await service.handle(INPUT);

    const [request] = provider.requests;
    expect(request?.system).toContain('PERFIL\nDatos de prueba');
    expect(request?.system).not.toContain(INPUT.message);
    expect(request?.messages.at(-1)).toEqual({ role: 'user', content: INPUT.message });
  });

  it('contact.phone is null without a lead and the profile phone with one', async () => {
    const withoutLead = await setup().service.handle(INPUT);
    const withLead = await setup({ repo: repoWithLead(0) }).service.handle(INPUT);

    expect(withoutLead.contact.phone).toBeNull();
    expect(withLead.contact.phone).toBe(FAKE_PHONE);
    expect(withLead.showCta).toBe(false);
  });

  it('lead captured and at the limit → LEAD_CAPTURED_REPLY, showCta false', async () => {
    const provider = fakeProvider(llmJson('no debería llamarse'));
    const { service } = setup({ repo: repoWithLead(5), providers: [provider] });

    const response = await service.handle(INPUT);

    expect(response).toMatchObject({
      reply: LEAD_CAPTURED_REPLY.es,
      reason: 'QUERY_LIMIT',
      showCta: false,
    });
    expect(provider.requests).toHaveLength(0);
  });

  it('answers the fixed reply in English when the visitor writes in English', async () => {
    const failing: LlmProvider = {
      name: 'groq',
      complete: async () => Promise.reject(new LlmProviderError('groq', 'client', 'HTTP 401')),
    };
    const { service } = setup({ providers: [failing] });

    const response = await service.handle({ ...INPUT, message: 'Does he know React?' });

    expect(response.reply).toBe(FIXED_REPLIES.LLM_UNAVAILABLE.en);
  });
});

describe('parseLlmOutput', () => {
  it('returns the model classification when the JSON is valid', () => {
    expect(parseLlmOutput(llmJson('Hola', false, true))).toEqual({
      reply: 'Hola',
      substantive: false,
      recruiterIntent: true,
    });
  });

  it.each(['no es JSON', '{"reply":"falta el resto"}', '{"reply":"","substantive":true}'])(
    'falls back to raw text + substantive for %s',
    (text) => {
      expect(parseLlmOutput(text)).toEqual({
        reply: text,
        substantive: true,
        recruiterIntent: false,
      });
    },
  );
});
