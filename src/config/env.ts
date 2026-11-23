import envSchema, { type JSONSchemaType } from 'env-schema';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  HOST: string;
  PORT: number;
  TRUST_PROXY: boolean;
  LOG_LEVEL: LogLevel;

  DATABASE_URL: string;
  /** Comma-separated list of allowed origins. Empty = no cross-origin requests allowed. */
  CORS_ORIGIN: string;
  ADMIN_API_KEY: string;
  IP_HASH_SALT: string;

  GROQ_API_KEY: string;
  GROQ_MODEL: string;
  /** Optional: without it the chat runs with Groq only (no fallback). */
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  LLM_TIMEOUT_MS: number;

  CHAT_QUERY_LIMIT: number;
  CHAT_HARD_MESSAGE_LIMIT: number;
  CHAT_DAILY_GLOBAL_LIMIT: number;
  CHAT_MAX_MESSAGE_CHARS: number;
  CHAT_HISTORY_WINDOW: number;

  /** Phase 5 (leads). Optional until the mail provider is chosen. */
  LEAD_NOTIFY_EMAIL?: string;
}

// Typed against Env: if the schema and the interface drift apart, tsc fails.
// DIRECT_DATABASE_URL and SEED_FORCE are read by prisma.config.ts / the seed, not by the app.
const schema: JSONSchemaType<Env> = {
  type: 'object',
  required: [
    'NODE_ENV',
    'HOST',
    'PORT',
    'TRUST_PROXY',
    'LOG_LEVEL',
    'DATABASE_URL',
    'CORS_ORIGIN',
    'ADMIN_API_KEY',
    'IP_HASH_SALT',
    'GROQ_API_KEY',
    'GROQ_MODEL',
    'LLM_TIMEOUT_MS',
    'CHAT_QUERY_LIMIT',
    'CHAT_HARD_MESSAGE_LIMIT',
    'CHAT_DAILY_GLOBAL_LIMIT',
    'CHAT_MAX_MESSAGE_CHARS',
    'CHAT_HISTORY_WINDOW',
  ],
  properties: {
    NODE_ENV: {
      type: 'string',
      enum: ['development', 'test', 'production'],
      default: 'development',
    },
    HOST: { type: 'string', default: '127.0.0.1' },
    PORT: { type: 'integer', minimum: 1, maximum: 65535, default: 3000 },
    TRUST_PROXY: { type: 'boolean', default: false },
    LOG_LEVEL: { type: 'string', enum: LOG_LEVELS, default: 'info' },

    DATABASE_URL: { type: 'string', minLength: 1 },
    CORS_ORIGIN: { type: 'string', default: '' },
    ADMIN_API_KEY: { type: 'string', minLength: 32 },
    IP_HASH_SALT: { type: 'string', minLength: 16 },

    GROQ_API_KEY: { type: 'string', minLength: 1 },
    GROQ_MODEL: { type: 'string', minLength: 1 },
    GEMINI_API_KEY: { type: 'string', minLength: 1, nullable: true },
    GEMINI_MODEL: { type: 'string', minLength: 1, nullable: true },
    LLM_TIMEOUT_MS: { type: 'integer', minimum: 1000, default: 15_000 },

    CHAT_QUERY_LIMIT: { type: 'integer', minimum: 1, default: 5 },
    CHAT_HARD_MESSAGE_LIMIT: { type: 'integer', minimum: 1, default: 20 },
    CHAT_DAILY_GLOBAL_LIMIT: { type: 'integer', minimum: 1, default: 300 },
    CHAT_MAX_MESSAGE_CHARS: { type: 'integer', minimum: 1, default: 500 },
    CHAT_HISTORY_WINDOW: { type: 'integer', minimum: 0, default: 10 },

    // No `format`: env-schema's ajv ships without ajv-formats.
    LEAD_NOTIFY_EMAIL: { type: 'string', minLength: 3, nullable: true },
  },
};

/**
 * Validates and coerces the environment. Throws with every problem listed at once.
 *
 * - Without `data`: reads `process.env` (runtime).
 * - With `data`: reads ONLY that object (tests), so the shell environment can't leak in.
 */
export function loadConfig(data?: Record<string, unknown>): Env {
  return envSchema<Env>(data ? { schema, data, env: false } : { schema, env: true });
}

/** `CORS_ORIGIN` as a list, ignoring blanks. */
export function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
  }
}
