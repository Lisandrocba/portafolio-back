# Roadmap

Fases en orden. Cada fase termina con `yarn lint && yarn typecheck && yarn test` en verde y docs actualizados si algo cambió.

## Fase 0: Documentación ✅

CLAUDE.md + `docs/`. Sin código de aplicación.

## Fase 1: Fundaciones

- [x] Dependencias: `@fastify/type-provider-zod`, `zod`, `env-schema` (ADR-026), `@fastify/{helmet,cors,rate-limit,under-pressure,sensible,swagger,swagger-ui}`, `fastify-plugin`, `vitest`, `undici@7` (misma major que el undici que trae Node 24, para que `MockAgent` intercepte el `fetch` nativo).
- [x] `tsconfig`: agregar `types: ["node"]`, quitar `jsx`; separar `tsconfig.json` (typecheck de `src/`, `test/`, `prisma/`) de `tsconfig.build.json` (emite solo `src/`).
- [x] Verificar que TypeScript 7 convive con Vitest y el resto del tooling. Vitest, tsx y commitlint andan con TS 7; typescript-eslint necesita la API de TS 6 (resuelto con alias, ADR-025).
- [x] Refactor `app.ts` → `buildApp(opts)`; `server.ts` con graceful shutdown (SIGINT/SIGTERM).
- [x] `config/env.ts` con todas las variables de [API.md](API.md#variables-de-entorno) + `.env.example`.
- [x] `plugins/security.ts`, `plugins/swagger.ts` (`/docs`), error handler en `lib/errors.ts`. `/health` como módulo propio (ADR-027).
- [x] Logger Pino con `redact` y serializer de `req` sin IP.
- [x] Vitest + `test/helpers/build-app.ts`; test de `/health` y de `/docs/json`. Además `test/helpers/mock-llm.ts` (MockAgent) con su propio test.
- [x] Scripts `test`, `test:watch`, `test:coverage`, `typecheck`.

## Fase 2: Datos

- [ ] Prisma `~7.10` + `@prisma/adapter-pg`; `prisma.config.ts`; generator con `output = src/generated/prisma` (agregarlo a `.gitignore`).
- [ ] `schema.prisma` según [DATA-MODEL.md](DATA-MODEL.md), con índices y `CHECK (id = 1)` en Profile.
- [ ] Primera migración contra Neon (branch de desarrollo).
- [ ] `plugins/prisma.ts` + `lib/prisma.ts`.
- [ ] `prisma/seed.ts` con [SEED-DATA.md](SEED-DATA.md) (guard de `SEED_FORCE`).
- [ ] Definir estrategia de DB de test (ver pendientes) y dejarla andando en el helper.
- [ ] Scripts `db:*`.

## Fase 3: Módulos del CV

- [ ] `plugins/auth.ts` (`requireAdmin`) + tests de 401.
- [ ] `profile` (+ languages, `yearsOfExperience` derivado, `phone` solo admin + `GET /admin/profile`).
- [ ] `technologies` (incluye "dónde se usó").
- [ ] `experience` (con `technologyIds`, `clientPublic`, `isCurrent`).
- [ ] `education`.
- [ ] Tests por módulo: público filtra `published`, schema público no filtra campos internos, admin ve todo, 404/409.

## Fase 4: Chat

Adelantada a las fases 2 y 3: `POST /chat` funciona con un repository en memoria (`chat.memory-repository.ts`) y con una copia fija del CV como contexto (`FALLBACK_CONTEXT` en `system-prompt.ts`). `buildApp()` tiene `TODO(fase 2)` y `TODO(fase 3)` donde hay que enchufar Prisma y los services del CV.

- [x] `providers/openai-compatible.provider.ts`: una clase para Groq y Gemini (JSON mode, timeout, mapeo de errores y tokens).
- [x] Tests de providers y failover con `MockAgent` (Groq 429 → Gemini; ambos caen → degradación).
- [x] `prompt/system-prompt.ts`.
- [ ] `prompt/profile-context.ts` (experiencias paralelas marcadas, `clientPublic` respetado). Necesita los tipos públicos de la fase 3; está excluido de coverage hasta entonces.
- [x] `quota.service.ts` (derivado por `visitorId` y día + antiabuso + global diario) con tests unitarios de los bordes (`LIMIT - 1`, `LIMIT`, cambio de día en Córdoba, otro `visitorId`, lead capturado, `recruiterIntent` pegajoso).
- [x] `chat.service.ts` + `POST /chat` (`visitorId`, `reason`, `contact`) + rate limit específico.
- [ ] Reemplazar el repository en memoria por `createChatRepository(prisma)` (fase 2) y `loadProfileContext` / `getContact` por los services del CV (fase 3). Ahí se borra `FALLBACK_CONTEXT`.
- [ ] Admin: `GET /admin/conversations`, `GET /admin/conversations/:id`.
- [ ] Evaluación manual del prompt: batería de preguntas (teléfono, salario, inglés, tecnología inexistente, intento de jailbreak, pregunta en inglés, "¿dónde trabaja ahora?").

## Fase 5: Leads

- [ ] **Decidir proveedor de mail** (ver pendientes).
- [ ] `POST /leads` (honeypot, 404/409, rate limit, `contact` con teléfono en el 201).
- [ ] Notificación por mail post-respuesta con form + conversación; `notifiedAt`.
- [ ] Admin: listar, ver con conversación, marcar `contactedAt`, reintentar notificación.

## Fase 6: Deploy

- [ ] **Decidir hosting** (ver pendientes).
- [ ] Env vars de producción, `TRUST_PROXY`, `CORS_ORIGIN` con la URL real del portfolio.
- [ ] `prisma migrate deploy` en el pipeline; seed una sola vez.
- [ ] CI en GitHub Actions: typecheck + test en cada PR.
- [ ] Smoke test en producción: `/health`, `/docs`, `GET /profile`, un `POST /chat`.

## Fase 7: Integración con el front

- [ ] Widget de chat en el portfolio con los estados de [CHAT-FLOW.md](CHAT-FLOW.md#estados-del-front): `visitorId` en `localStorage`, UI según `reason`, `contact` debajo de la respuesta.
- [ ] Secciones del portfolio consumiendo los GET públicos (si se migra el contenido hoy hardcodeado).

## Fase 8: Ajuste con datos reales

- [ ] Revisar conversaciones y leads; ajustar `CHAT_QUERY_LIMIT` (4–6).
- [ ] Iterar el system prompt (ganchos, detección de reclutador, falsos positivos/negativos de `substantive`).
- [ ] Ajustar `CHAT_DAILY_GLOBAL_LIMIT` según el consumo real.
- [ ] Implementar la política de retención decidida.

---

## Pendiente de decidir

| Tema                             | Opciones / notas                                                                                                                                                                                                                                                       | Bloquea                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Hosting del Fastify**          | Requisitos: proceso long-running (no serverless puro, por el tope en memoria), una instancia, HTTPS, env vars. Si el free tier duerme la instancia, se suma cold start y se reinicia el tope global (aceptable). Candidatos a evaluar: Render, Railway, Fly.io, Koyeb. | Fase 6                    |
| **Proveedor de mail para leads** | Necesita API HTTP y free tier suficiente para pocos mails por día. Ojo: el destino es Hotmail/Outlook, que es estricto con la entregabilidad (dominio verificado, SPF/DKIM). Candidatos a evaluar: Resend, Brevo, Postmark, SMTP de Gmail.                             | Fase 5                    |
| **Modelos concretos**            | Groq: `openai/gpt-oss-120b`, probado con JSON mode (nov. 2026; `llama-3.3-70b-versatile` ya no existe en Groq). Free tier: 1000 requests/día y 8000 tokens/min. Falta el ID de Gemini Flash-Lite y probar JSON mode en su endpoint compatible con OpenAI.              | Fase 4                    |
| **URL del portfolio**            | Falta la URL de GitHub Pages: `Profile.portfolioUrl` y `CORS_ORIGIN`.                                                                                                                                                                                                  | Fase 2 (seed) / Fase 6    |
| **DB de test**                   | Branch de Neon dedicado o Postgres local en Docker. Recomendación: Docker local para tests (rápido, offline, desechable) y Neon solo para dev/prod.                                                                                                                    | Fase 2                    |
| **Retención de conversaciones**  | Purgar conversaciones sin lead después de N días (¿90?). Las que tienen lead no se borran (`Restrict`).                                                                                                                                                                | Fase 8                    |
| **Meses del título de grado**    | "2017 a 2019" sin meses: se guarda `2017-01-01` / `2019-01-01` provisoriamente.                                                                                                                                                                                        | Fase 2 (seed)             |
| **Vínculos faltantes del seed**  | Ver "Para revisar" en [SEED-DATA.md](SEED-DATA.md): "SQL" genérico, tecnologías mencionadas en viñetas pero no en el stack, y tecnologías por formación.                                                                                                               | Post fase 2 (por Postman) |
| **Datos de perfil sin cargar**   | `availability` (null) y `level` / `yearsOfUse` de cada tecnología.                                                                                                                                                                                                     | Post fase 2 (por Postman) |
