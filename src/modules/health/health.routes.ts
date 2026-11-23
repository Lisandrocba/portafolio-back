import type { FastifyPluginAsyncZod } from '@fastify/type-provider-zod';
import { z } from 'zod';

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      // Hit every few seconds by the hosting's health check: keep it out of the logs.
      logLevel: 'silent',
      schema: {
        tags: ['health'],
        summary: 'Liveness check',
        response: { 200: HealthResponseSchema },
      },
    },
    async () => ({ status: 'ok' as const }),
  );
};
