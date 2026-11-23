import type { PrismaClient } from '../../src/lib/prisma.js';

/**
 * The Docker database from docker-compose.yml. .env.test (loaded by test/setup.ts) or CI can
 * point DATABASE_URL somewhere else; setup.ts refuses any database whose name lacks "test".
 */
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/portfolio_test';

/** Empties every table (not the migrations table). Call it in beforeEach of DB tests. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`
    TRUNCATE "Lead", "Message", "Conversation",
             "Profile", "Language", "Experience", "Technology", "Education"
    CASCADE`;
}
