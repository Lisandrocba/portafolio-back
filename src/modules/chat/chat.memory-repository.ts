import { randomUUID } from 'node:crypto';
import type { ChatRepository, HistoryMessage, NewConversation } from './chat.repository.js';

/**
 * ChatRepository kept in memory: lets POST /chat work before the database exists (fase 2).
 * Everything is lost on restart, so the daily quota resets too. Once the Prisma repository
 * exists, buildApp() uses that one and this stays as the fake repo for unit tests.
 */

interface StoredConversation extends NewConversation {
  lastSeenAt: Date;
}

interface StoredMessage extends HistoryMessage {
  conversationId: string;
  visitorId: string;
  createdAt: Date;
  /** Only USER messages carry the LLM classification. */
  substantive?: boolean;
  recruiterIntent?: boolean;
}

export function createInMemoryChatRepository(now: () => Date = () => new Date()) {
  const conversations = new Map<string, StoredConversation>();
  const messages: StoredMessage[] = [];

  /** USER messages of every conversation of the visitor. */
  const userMessagesOf = (visitorId: string) =>
    messages.filter((m) => m.visitorId === visitorId && m.role === 'USER');

  const repo: ChatRepository = {
    async findConversationId(conversationId) {
      return conversations.has(conversationId) ? conversationId : null;
    },

    async createConversation(data) {
      const id = randomUUID();
      conversations.set(id, { ...data, lastSeenAt: now() });
      return { id };
    },

    async touchConversation(conversationId) {
      const conversation = conversations.get(conversationId);
      if (conversation) conversation.lastSeenAt = now();
    },

    async countVisitorMessagesSince(visitorId, since) {
      const today = userMessagesOf(visitorId).filter((m) => m.createdAt >= since);
      return {
        substantiveUserMessages: today.filter((m) => m.substantive).length,
        totalUserMessages: today.length,
      };
    },

    async hasRecruiterIntent(visitorId) {
      return userMessagesOf(visitorId).some((m) => m.recruiterIntent);
    },

    // Leads arrive in fase 5: until then nobody has one.
    async hasLead() {
      return false;
    },

    async getHistory(conversationId, limit) {
      if (limit === 0) return []; // slice(-0) would return everything
      return messages
        .filter((m) => m.conversationId === conversationId)
        .slice(-limit)
        .map(({ role, content }) => ({ role, content }));
    },

    async saveExchange(conversationId, user, assistant) {
      const visitorId = conversations.get(conversationId)?.visitorId ?? '';
      const createdAt = now();
      messages.push(
        { conversationId, visitorId, createdAt, role: 'USER', ...user },
        { conversationId, visitorId, createdAt, role: 'ASSISTANT', content: assistant.content },
      );
    },
  };

  // `conversations` is exposed read-only so tests can check what was stored (e.g. the ipHash).
  return { ...repo, conversations: conversations as ReadonlyMap<string, StoredConversation> };
}
