import { notImplemented } from '../../../lib/not-implemented.js';

/**
 * CV data the bot can see, already filtered by the CV services (published = true, order,
 * clientPublic) — the same thing the public API returns. Never the phone (rule 2).
 *
 * TODO(fase 3): replace `unknown` with the PUBLIC response types of each module
 * (z.infer of ProfilePublicSchema, ExperiencePublicSchema, …).
 */
export interface CvSnapshot {
  profile: unknown; // includes languages and the derived yearsOfExperience
  experiences: unknown[];
  technologies: unknown[];
  education: unknown[];
}

/**
 * Pure function: snapshot → compact text for the system prompt. Fetching the snapshot
 * (Promise.all over the CV services) is chat.service's job, so this is unit-tested with
 * plain objects, no DB.
 *
 * TODO(fase 4): format as in docs/CHAT-FLOW.md#contexto-del-cv-profile-contextts:
 *  - PERFIL · EXPERIENCIA · TECNOLOGÍAS · FORMACIÓN · IDIOMAS
 *  - experiences with isCurrent → "[ACTUAL — en paralelo]"
 *  - client only when clientPublic (the public schema should already omit it)
 *  - dates with month precision ("sept. 2025 a hoy")
 */
export function formatProfileContext(_snapshot: CvSnapshot): string {
  return notImplemented('formatProfileContext');
}
