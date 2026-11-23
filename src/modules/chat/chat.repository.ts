/**
 * Persistence of Conversation + Message. Only the CONTRACT lives here for now: the Prisma
 * implementation needs the generated client (fase 2).
 *
 * Rule 4: services depend on this interface, never on PrismaClient. Domain types in,
 * domain types out; Prisma errors are translated to lib/errors.ts inside the implementation.
 *
 * TODO(fase 2): `export function createChatRepository(prisma: PrismaClient): ChatRepository`
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
