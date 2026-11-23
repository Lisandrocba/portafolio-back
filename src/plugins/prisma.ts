import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createPrismaClient, type PrismaClient } from '../lib/prisma.js';

/**
 * Decorates `app.prisma` with the pooled connection (DATABASE_URL). It connects lazily, on the
 * first query, so routes that don't touch the database (/health, /docs) work without it.
 */
async function prisma(app: FastifyInstance) {
  const client = createPrismaClient(app.config.DATABASE_URL);
  app.decorate('prisma', client);

  // Graceful shutdown: server.ts calls app.close(), which runs this hook.
  app.addHook('onClose', async () => {
    await client.$disconnect();
  });
}

export default fp(prisma, { name: 'prisma', fastify: '5.x' });

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
