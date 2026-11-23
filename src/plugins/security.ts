import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import underPressure from '@fastify/under-pressure';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { parseOrigins } from '../config/env.js';

/** Global defaults. POST /chat and POST /leads set stricter limits on their own routes. */
const GLOBAL_RATE_LIMIT = { max: 100, timeWindow: '1 minute' } as const;

async function security(app: FastifyInstance) {
  // Default CSP: this is a JSON API. swagger-ui sets its own CSP on /docs (staticCSP).
  await app.register(helmet);

  const origins = parseOrigins(app.config.CORS_ORIGIN);
  await app.register(cors, {
    origin: origins.length > 0 ? origins : false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    // No cookies or sessions: the admin key travels in a header and never from the browser.
    credentials: false,
  });

  // Keyed by request.ip: behind the hosting proxy this needs TRUST_PROXY=true.
  await app.register(rateLimit, { global: true, ...GLOBAL_RATE_LIMIT });

  // 503 instead of degrading everything when the event loop is saturated.
  // Its own /health route is off: it declares a JSON Schema and the Zod serializer rejects it.
  await app.register(underPressure, {
    maxEventLoopDelay: 1000,
    exposeStatusRoute: false,
  });

  await app.register(sensible);
}

export default fp(security, { name: 'security', fastify: '5.x' });
