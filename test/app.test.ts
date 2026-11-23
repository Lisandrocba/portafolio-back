import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { App } from '../src/lib/types.js';
import { buildTestApp, TEST_ENV } from './helpers/build-app.js';

describe('buildApp', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('env', () => {
    it('exposes the validated config with defaults applied and numbers coerced', () => {
      expect(app.config.PORT).toBe(3000);
      expect(app.config.CHAT_QUERY_LIMIT).toBe(5);
      expect(app.config.TRUST_PROXY).toBe(false);
    });

    it('coerces string values the way process.env delivers them', async () => {
      const custom = await buildTestApp({ CHAT_QUERY_LIMIT: '4', TRUST_PROXY: 'true' });
      try {
        expect(custom.config.CHAT_QUERY_LIMIT).toBe(4);
        expect(custom.config.TRUST_PROXY).toBe(true);
      } finally {
        await custom.close();
      }
    });

    it('refuses to start when a required variable is missing', async () => {
      const { GROQ_API_KEY: _omitted, ...env } = TEST_ENV;

      await expect(buildApp({ env })).rejects.toThrow(/GROQ_API_KEY/);
    });

    it('refuses an ADMIN_API_KEY shorter than 32 characters', async () => {
      await expect(buildApp({ env: { ...TEST_ENV, ADMIN_API_KEY: 'short' } })).rejects.toThrow(
        /ADMIN_API_KEY/,
      );
    });
  });

  describe('docs', () => {
    it('serves the OpenAPI document at /docs/json', async () => {
      const response = await app.inject({ method: 'GET', url: '/docs/json' });

      expect(response.statusCode).toBe(200);
      const doc = response.json<{ openapi: string; paths: Record<string, unknown> }>();
      expect(doc.openapi).toMatch(/^3\./);
      expect(doc.paths).toHaveProperty('/health');
    });
  });

  describe('errors', () => {
    it('answers unknown routes with the single error shape', async () => {
      const response = await app.inject({ method: 'GET', url: '/does-not-exist' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ statusCode: 404, error: 'Not Found' });
    });
  });

  describe('security', () => {
    it('sets helmet headers', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('allows the configured origin and nobody else', async () => {
      const allowed = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: TEST_ENV.CORS_ORIGIN },
      });
      const foreign = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'https://evil.example.com' },
      });

      expect(allowed.headers['access-control-allow-origin']).toBe(TEST_ENV.CORS_ORIGIN);
      expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('applies the global rate limit', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});
