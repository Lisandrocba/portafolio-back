import type { FastifyServerOptions } from 'fastify';
import type { Env } from './env.js';

// Pino redact paths. Headers aren't logged by default, but anything that logs a request,
// a provider error or the config by hand still goes through here.
const REDACT_PATHS = [
  'req.headers["x-admin-key"]',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers["x-admin-key"]',
  'headers.authorization',
  'headers["x-goog-api-key"]',
  '*.ADMIN_API_KEY',
  '*.IP_HASH_SALT',
  '*.GROQ_API_KEY',
  '*.GEMINI_API_KEY',
  '*.DATABASE_URL',
];

// The object form of Fastify's `logger` option (Fastify doesn't export pino's LoggerOptions).
type LoggerOptions = Exclude<FastifyServerOptions['logger'], boolean | undefined>;

export function buildLoggerOptions(config: Env): LoggerOptions {
  return {
    level: config.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    serializers: {
      // Default serializer logs remoteAddress: the IP never goes to the logs in clear (rule 9).
      req: (request: { method: string; url: string }) => ({
        method: request.method,
        url: request.url,
      }),
    },
  };
}
