import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export type { PrismaClient };

/**
 * PrismaClient over node-postgres (ADR-013). Shared by plugins/prisma.ts and the seed.
 * Only repositories (and the seed) use the client: services never see Prisma (rule 4).
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
