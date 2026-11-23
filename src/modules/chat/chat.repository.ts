import type { PrismaClient } from '../../lib/prisma.js';

/**
 * Persistence of Conversation + Message: the contract (ChatRepository) and its Prisma
 * implementation. test/helpers/memory-chat-repository.ts implements the same contract for unit tests.
 *
 * Rule 4: services depend on this interface, never on PrismaClient. Domain types in,
 * domain types out; Prisma errors are translated to lib/errors.ts inside the implementation.
 */

export interface NewConversation {
  visitorId: string;
  ipHash: string;
  userAgent: string | null; // truncated to 512
  referrer: string | null; // truncated to 512
}

export interface HistoryMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface UserMessageToSave {
  content: string;
  substantive: boolean;
  recruiterIntent: boolean;
}

export interface AssistantMessageToSave {
  content: string;
  /** null = fixed reply, the LLM wasn't called (or every provider failed). */
  provider: string | null;
  tokensUsed: number | null;
}

/** Everything "of the visitor" = across every conversation with that visitorId. */
export interface VisitorDailyCounts {
  /** USER messages with substantive = true since `since`. The quota counter (rule 5). */
  substantiveUserMessages: number;
  /** Every USER message since `since`, substantive or not (anti-abuse). */
  totalUserMessages: number;
}

export interface ChatRepository {
  /** Returns the id if the conversation exists, null otherwise (never throws NotFound). */
  findConversationId(conversationId: string): Promise<string | null>;
  createConversation(data: NewConversation): Promise<{ id: string }>;
  /** Updates lastSeenAt. */
  touchConversation(conversationId: string): Promise<void>;

  countVisitorMessagesSince(visitorId: string, since: Date): Promise<VisitorDailyCounts>;
  /** Sticky: any USER message of the visitor, ever, with recruiterIntent = true. */
  hasRecruiterIntent(visitorId: string): Promise<boolean>;
  /** A Lead exists in any conversation of the visitor. */
  hasLead(visitorId: string): Promise<boolean>;

  /** Last `limit` messages, oldest first, ready to send as history. */
  getHistory(conversationId: string, limit: number): Promise<HistoryMessage[]>;
  /** USER + ASSISTANT in a single transaction. */
  saveExchange(
    conversationId: string,
    user: UserMessageToSave,
    assistant: AssistantMessageToSave,
  ): Promise<void>;
}

export function createChatRepository(prisma: PrismaClient): ChatRepository {
  return {
    async findConversationId(conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      return conversation?.id ?? null;
    },

    async createConversation(data) {
      return prisma.conversation.create({ data, select: { id: true } });
    },

    async touchConversation(conversationId) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastSeenAt: new Date() },
      });
    },

    // The counter is always a count, never a stored number (rule 5).
    async countVisitorMessagesSince(visitorId, since) {
      const today = {
        role: 'USER',
        createdAt: { gte: since },
        conversation: { visitorId },
      } as const;
      const [substantiveUserMessages, totalUserMessages] = await Promise.all([
        prisma.message.count({ where: { ...today, substantive: true } }),
        prisma.message.count({ where: today }),
      ]);
      return { substantiveUserMessages, totalUserMessages };
    },

    async hasRecruiterIntent(visitorId) {
      const message = await prisma.message.findFirst({
        where: { role: 'USER', recruiterIntent: true, conversation: { visitorId } },
        select: { id: true },
      });
      return message !== null;
    },

    async hasLead(visitorId) {
      const lead = await prisma.lead.findFirst({
        where: { conversation: { visitorId } },
        select: { id: true },
      });
      return lead !== null;
    },

    async getHistory(conversationId, limit) {
      if (limit === 0) return [];
      // The newest `limit` messages, then flipped so the oldest goes first.
      // Question and answer share createdAt (same INSERT), so `id` breaks the tie:
      // cuids grow over time, and the question is always created first.
      const newestFirst = await prisma.message.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: { role: true, content: true },
      });
      return newestFirst.reverse();
    },

    async saveExchange(conversationId, user, assistant) {
      // createMany is a single INSERT: both messages are saved or neither is.
      await prisma.message.createMany({
        data: [
          { conversationId, role: 'USER', ...user },
          { conversationId, role: 'ASSISTANT', ...assistant },
        ],
      });
    },
  };
}
