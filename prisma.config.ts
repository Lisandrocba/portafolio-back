import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads .env by itself. Like server.ts, local dev loads it; in CI and
// production the variables come from the environment and there is no file.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Migrations need a direct connection: Neon's pooler (PgBouncer) can't run them.
  // The app itself uses the pooled DATABASE_URL (lib/prisma.ts).
  datasource: {
    url: env('DIRECT_DATABASE_URL'),
  },
});
