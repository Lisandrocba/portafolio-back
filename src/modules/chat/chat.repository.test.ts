import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase, TEST_DATABASE_URL } from '../../../test/helpers/database.js';
import { createPrismaClient } from '../../lib/prisma.js';
import { createChatRepository } from './chat.repository.js';

// Integration tests against the test database: the queries are what's under test here.

const prisma = createPrismaClient(TEST_DATABASE_URL);
const repo = createChatRepository(prisma);

const VISITOR = randomUUID();
const OTHER_VISITOR = randomUUID();

const newConversation = (visitorId = VISITOR) =>
  repo.createConversation({ visitorId, ipHash: 'hash', userAgent: null, referrer: null });

const ANSWER = { content: 'respuesta', provider: 'groq', tokensUsed: 10 };
const question = (substantive: boolean, recruiterIntent = false) => ({
  content: 'pregunta',
  substantive,
  recruiterIntent,
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('createChatRepository', () => {
  it('findConversationId returns the id if it exists and null otherwise', async () => {
    const { id } = await newConversation();

    expect(await repo.findConversationId(id)).toBe(id);
    expect(await repo.findConversationId(randomUUID())).toBeNull();
  });

  it('touchConversation moves lastSeenAt forward', async () => {
    const { id } = await newConversation();
    const before = await prisma.conversation.findUniqueOrThrow({ where: { id } });

    await repo.touchConversation(id);

    const after = await prisma.conversation.findUniqueOrThrow({ where: { id } });
    expect(after.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.lastSeenAt.getTime());
  });

  it('counts USER messages of every conversation of the visitor, and only of that visitor', async () => {
    const first = await newConversation();
    const second = await newConversation();
    const theirs = await newConversation(OTHER_VISITOR);
    const since = new Date(Date.now() - 60_000);
    await repo.saveExchange(first.id, question(true), ANSWER);
    await repo.saveExchange(second.id, question(true), ANSWER);
    await repo.saveExchange(second.id, question(false), ANSWER);
    await repo.saveExchange(theirs.id, question(true), ANSWER);

    expect(await repo.countVisitorMessagesSince(VISITOR, since)).toEqual({
      substantiveUserMessages: 2,
      totalUserMessages: 3, // ASSISTANT messages never count
    });
  });

  it('does not count messages from before `since` (e.g. yesterday)', async () => {
    const { id } = await newConversation();
    await repo.saveExchange(id, question(true), ANSWER);
    const since = new Date(Date.now() + 60_000); // the message is older than this

    expect(await repo.countVisitorMessagesSince(VISITOR, since)).toEqual({
      substantiveUserMessages: 0,
      totalUserMessages: 0,
    });
  });

  it('hasRecruiterIntent is sticky across conversations', async () => {
    const first = await newConversation();
    const second = await newConversation();
    await repo.saveExchange(first.id, question(true, true), ANSWER);
    await repo.saveExchange(second.id, question(false), ANSWER);

    expect(await repo.hasRecruiterIntent(VISITOR)).toBe(true);
    expect(await repo.hasRecruiterIntent(OTHER_VISITOR)).toBe(false);
  });

  it('hasLead finds a lead in any conversation of the visitor', async () => {
    const { id } = await newConversation();
    expect(await repo.hasLead(VISITOR)).toBe(false);

    await prisma.lead.create({
      data: { conversationId: id, name: 'Ana', email: 'ana@example.com', message: 'Busco dev' },
    });

    expect(await repo.hasLead(VISITOR)).toBe(true);
    expect(await repo.hasLead(OTHER_VISITOR)).toBe(false);
  });

  it('getHistory returns the last `limit` messages, oldest first, question before answer', async () => {
    const { id } = await newConversation();
    await repo.saveExchange(id, { ...question(true), content: 'P1' }, { ...ANSWER, content: 'R1' });
    await repo.saveExchange(id, { ...question(true), content: 'P2' }, { ...ANSWER, content: 'R2' });

    expect(await repo.getHistory(id, 3)).toEqual([
      { role: 'ASSISTANT', content: 'R1' },
      { role: 'USER', content: 'P2' },
      { role: 'ASSISTANT', content: 'R2' },
    ]);
    expect(await repo.getHistory(id, 0)).toEqual([]);
  });

  it('saveExchange stores the classification on USER and provider/tokens on ASSISTANT', async () => {
    const { id } = await newConversation();

    await repo.saveExchange(id, question(true, true), {
      content: 'fija',
      provider: null,
      tokensUsed: null,
    });

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages).toMatchObject([
      { role: 'USER', substantive: true, recruiterIntent: true, provider: null },
      { role: 'ASSISTANT', content: 'fija', provider: null, tokensUsed: null },
    ]);
  });
});
