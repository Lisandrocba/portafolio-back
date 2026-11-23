import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import Fastify from 'fastify';
import { loadConfig } from './config/env.js';
import { buildLoggerOptions } from './config/logger.js';
import { errorHandler } from './lib/errors.js';
import type { App } from './lib/types.js';
import { healthRoutes } from './modules/health/health.routes.js';
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
  // TODO(fase 2): plugins/prisma.ts · TODO(fase 3): plugins/auth.ts

  // 4. Single error shape for the whole API.
  app.setErrorHandler(errorHandler);

  // 5. Composition: repositories → services → routes, one register per module.
  await app.register(healthRoutes);
  // TODO(fase 4): wire the chat here (providers → quota → chat.service → chatRoutes).
  // The register call is in the header comment of src/modules/chat/chat.routes.ts.

  return app;
}
