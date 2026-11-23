import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import type { ChatService } from './chat.service.js';
import { ChatResponseSchema, createChatRequestSchema } from './chat.schemas.js';

export interface ChatRoutesOptions {
  service: ChatService;
  maxMessageChars: number;
}

/** Stricter than the global limit: each request may cost LLM quota (docs/API.md). */
const CHAT_RATE_LIMIT = { max: 10, timeWindow: '1 minute' } as const;

/**
 * POST /chat. Thin on purpose: validate → service → serialize. All logic lives in chat.service.
 *
 * TODO(fase 4): register it in buildApp() once the service is implemented:
 *   await app.register(chatRoutes, { service: chatService, maxMessageChars: config.CHAT_MAX_MESSAGE_CHARS });
 */
export const chatRoutes: FastifyPluginAsyncZod<ChatRoutesOptions> = async (app, opts) => {
  app.post(
    '/chat',
    {
      config: { rateLimit: CHAT_RATE_LIMIT },
      schema: {
        tags: ['chat'],
        summary: 'Envía un mensaje al asistente del portfolio',
        description:
          'Siempre 200, incluso con el LLM caído: `reason` indica por qué se respondió así. Ver docs/CHAT-FLOW.md.',
        body: createChatRequestSchema(opts.maxMessageChars),
        response: { 200: ChatResponseSchema },
      },
    },
    async (request) =>
      opts.service.handle({
        ...request.body,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        referrer: request.headers.referer ?? null,
      }),
  );
};
