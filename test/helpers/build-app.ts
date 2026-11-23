import { buildApp } from '../../src/app.js';
import type { App } from '../../src/lib/types.js';
import { TEST_DATABASE_URL } from './database.js';

/**
 * Fake but valid values for every required variable. Nothing here is a real secret,
 * and the LLM keys are never used against a real API (MockAgent intercepts fetch).
 */
export const TEST_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: TEST_DATABASE_URL,
  CORS_ORIGIN: 'http://localhost:5173',
  ADMIN_API_KEY: 'test-admin-key-0123456789abcdef0123',
  IP_HASH_SALT: 'test-ip-hash-salt-0123456789',
  GROQ_API_KEY: 'test-groq-key',
  GROQ_MODEL: 'test-groq-model',
  GEMINI_API_KEY: 'test-gemini-key',
  GEMINI_MODEL: 'test-gemini-model',
} as const satisfies Record<string, string>;

/** buildApp() with the test env (plus overrides), ready to receive app.inject(). */
export async function buildTestApp(envOverrides: Record<string, unknown> = {}): Promise<App> {
  const app = await buildApp({ env: { ...TEST_ENV, ...envOverrides } });
  await app.ready();
  return app;
}
