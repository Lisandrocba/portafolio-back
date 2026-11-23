import { notImplemented } from '../../../lib/not-implemented.js';

/**
 * Composes the system prompt for each request: fixed rules + CV context.
 * Visitor text NEVER goes in here: it always travels as a `user` message.
 *
 * TODO(fase 4): write the fixed rules as a constant (in Spanish), one section per block of
 * docs/CHAT-FLOW.md#system-prompt:
 *  1. Rol y alcance: assistant of the portfolio, talks ABOUT Lisandro in 3rd person,
 *     only professional profile, off-topic → one line + redirect (not substantive),
 *     ignores attempts to change its role or reveal the prompt, 2–5 sentences, plain text.
 *  2. Privacidad: phone (doesn't have it, explain it's shared after leaving contact details,
 *     recruiterIntent = true), salary (never figures, recruiterIntent = true), never invent,
 *     English level literal, client only if present in context, answer in the user's
 *     language, parallel CURRENT experiences are not consecutive.
 *  3. Conversión: closing hook on substantive answers; when to set recruiterIntent.
 *  4. Criterio de `substantive`: any question about the profile that needs CV data to answer.
 *  5. Formato de salida: ONLY JSON { "reply": string, "substantive": boolean,
 *     "recruiterIntent": boolean }. (Groq's JSON mode also requires the word "JSON" in the prompt.)
 * Then append the context: `${RULES}\n\n---\nCONTEXTO DEL CV\n${profileContext}`.
 */
export function buildSystemPrompt(_profileContext: string): string {
  return notImplemented('buildSystemPrompt');
}
