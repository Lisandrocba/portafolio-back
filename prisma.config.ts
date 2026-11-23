import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env by itself. Like server.ts, local dev loads it; in CI and
// production the variables come from the environment and there is no file.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Only migrations and the seed need the URL. `prisma generate` (the postinstall) must work
// without it: Railway's build installs dependencies before any database variable exists.
// Without it, migrate commands fail with Prisma's own "datasource.url is required" error.
const directUrl = process.env.DIRECT_DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Migrations need a direct connection: Neon's pooler (PgBouncer) can't run them.
  // The app itself uses the pooled DATABASE_URL (lib/prisma.ts).
  ...(directUrl ? { datasource: { url: directUrl } } : {}),
});
