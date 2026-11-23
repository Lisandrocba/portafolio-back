import { z } from 'zod';

/**
 * Contract of POST /chat (docs/CHAT-FLOW.md#contrato-de-post-chat).
 * These schemas validate input, serialize output and generate the OpenAPI doc.
 */

export const CHAT_REASONS = [
  'OK', // normal LLM answer
  'QUERY_LIMIT', // visitor used CHAT_QUERY_LIMIT substantive queries today
  'ABUSE_LIMIT', // visitor sent CHAT_HARD_MESSAGE_LIMIT messages today
  'GLOBAL_LIMIT', // server-wide daily LLM cap reached
  'LLM_UNAVAILABLE', // every provider failed
] as const;

export const ChatReasonSchema = z.enum(CHAT_REASONS);
export type ChatReason = z.infer<typeof ChatReasonSchema>;

/** The limit comes from CHAT_MAX_MESSAGE_CHARS, so the schema is built from config. */
export function createChatRequestSchema(maxMessageChars: number) {
  return z.object({
    // Absent or null → the backend creates one. Invalid format → 400.
    visitorId: z.uuid().nullish(),
    // Absent, null or unknown → a new conversation is created silently. Never 404.
    conversationId: z.uuid().nullish(),
    message: z.string().trim().min(1).max(maxMessageChars),
  });
}
export type ChatRequest = z.infer<ReturnType<typeof createChatRequestSchema>>;

export const ContactSchema = z.object({
  email: z.string(),
  linkedinUrl: z.string(),
  // null until the visitor leaves a lead (ADR-021). Never comes from the LLM.
  phone: z.string().nullable(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const ChatResponseSchema = z.object({
  visitorId: z.uuid(),
  conversationId: z.uuid(),
  reply: z.string(),
  remaining: z.number().int().min(0),
  showCta: z.boolean(),
  reason: ChatReasonSchema,
  contact: ContactSchema,
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

/**
 * What the LLM must answer in JSON mode (ADR-010). Parsed in chat.service; if it doesn't
 * parse: reply = raw text, substantive = true, recruiterIntent = false.
 */
export const LlmOutputSchema = z.object({
  reply: z.string().trim().min(1),
  substantive: z.boolean(),
  recruiterIntent: z.boolean(),
});
export type LlmOutput = z.infer<typeof LlmOutputSchema>;
