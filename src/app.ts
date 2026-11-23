import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify from 'fastify';
import { loadConfig } from './config/env.js';
import { buildLoggerOptions } from './config/logger.js';
import { errorHandler } from './lib/errors.js';
import { createIpHasher } from './lib/ip-hash.js';
import type { App } from './lib/types.js';
import { createChatRepository } from './modules/chat/chat.repository.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import { createChatService } from './modules/chat/chat.service.js';
import { createLlmProviders } from './modules/chat/providers/openai-compatible.provider.js';
import { createQuotaService } from './modules/chat/quota.service.js';
import { healthRoutes } from './modules/health/health.routes.js';
import prismaPlugin from './plugins/prisma.js';
import securityPlugin from './plugins/security.js';
import swaggerPlugin from './plugins/swagger.js';

export interface BuildAppOptions {
  /** Environment to validate instead of `process.env` (tests). */
  env?: Record<string, unknown>;
}

/**
 * Composition root: validates the env, registers plugins and modules. Never calls `listen`
 * (that's server.ts), so tests drive it in memory with `app.inject()`.
 */
export async function buildApp(opts: BuildAppOptions = {}): Promise<App> {
  // 1. Env first, before the instance: logger level and trustProxy are constructor options.
  const config = loadConfig(opts.env);

  const app = Fastify({
    logger: buildLoggerOptions(config),
    trustProxy: config.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>();

  app.decorate('config', config);

  // 2. Zod type provider: validates input, serializes output and feeds the OpenAPI doc.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 3. Cross-cutting plugins. Swagger goes before any route so it can see them.
  await app.register(securityPlugin);
  await app.register(swaggerPlugin);
  await app.register(prismaPlugin);
  // TODO(fase 3): plugins/auth.ts

  // 4. Single error shape for the whole API.
  app.setErrorHandler(errorHandler);

  // 5. Composition: repositories → services → routes, one register per module.
  await app.register(healthRoutes);

  const chatRepo = createChatRepository(app.prisma);
  const chatService = createChatService({
    repo: chatRepo,
    quota: createQuotaService({
      repo: chatRepo,
      config: {
        queryLimit: config.CHAT_QUERY_LIMIT,
        hardMessageLimit: config.CHAT_HARD_MESSAGE_LIMIT,
        dailyGlobalLimit: config.CHAT_DAILY_GLOBAL_LIMIT,
      },
    }),
    providers: createLlmProviders(config),
    // TODO(fase 3): read both from the CV services (formatProfileContext and Profile).
    loadProfileContext: async () => '',
    getContact: async () => TEMPORARY_CONTACT,
    hashIp: createIpHasher(config.IP_HASH_SALT),
    config: { historyWindow: config.CHAT_HISTORY_WINDOW },
    log: app.log,
  });
  await app.register(chatRoutes, {
    service: chatService,
    maxMessageChars: config.CHAT_MAX_MESSAGE_CHARS,
  });

  return app;
}

/**
 * Until Profile exists (fase 3), from docs/SEED-DATA.md. Never the phone (rule 2):
 * nobody can leave a lead yet, so `phone` is always null.
 */
const TEMPORARY_CONTACT = {
  email: 'lisandrocba_7@hotmail.com',
  linkedinUrl: 'https://www.linkedin.com/in/lisandrocordoba',
  phone: null,
};
