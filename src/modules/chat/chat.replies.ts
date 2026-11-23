import type { ChatReason } from './chat.schemas.js';

/**
 * Fixed replies sent WITHOUT calling the LLM (ADR-011), in Spanish and English.
 *
 * TODO(fase 4): BORRADOR. Revisá y ajustá el tono de cada texto: son la última impresión
 * antes del CTA. La idea de cada uno sale de docs/CHAT-FLOW.md.
 */

export type ReplyLanguage = 'es' | 'en';
export type FixedReason = Exclude<ChatReason, 'OK'>;

export const FIXED_REPLIES: Record<FixedReason, Record<ReplyLanguage, string>> = {
  QUERY_LIMIT: {
    es: 'Llegaste al límite de consultas de hoy. Para seguir, dejame tus datos y Lisandro te escribe.',
    en: "You've reached today's question limit. Leave your details and Lisandro will get back to you.",
  },
  ABUSE_LIMIT: {
    es: 'Llegaste al límite de mensajes de hoy. Para seguir, dejame tus datos y Lisandro te escribe.',
    en: "You've reached today's message limit. Leave your details and Lisandro will get back to you.",
  },
  GLOBAL_LIMIT: {
    es: 'Hoy hay mucha demanda en el chat. Dejame tus datos y Lisandro te escribe.',
    en: 'The chat is very busy today. Leave your details and Lisandro will get back to you.',
  },
  LLM_UNAVAILABLE: {
    es: 'El asistente no está disponible en este momento. Probá de nuevo más tarde o dejame tus datos y Lisandro te escribe.',
    en: "The assistant isn't available right now. Try again later, or leave your details and Lisandro will get back to you.",
  },
};

/** At the limit but with a lead already captured: no CTA, different text (CHAT-FLOW, rule 6). */
export const LEAD_CAPTURED_REPLY: Record<ReplyLanguage, string> = {
  es: 'Ya tengo tus datos: Lisandro te va a escribir.',
  en: 'I already have your details: Lisandro will get in touch.',
};
