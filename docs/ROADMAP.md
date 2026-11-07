# Roadmap

Fases en orden. Cada fase termina con `yarn typecheck && yarn test` en verde y docs actualizados si algo cambió.

## Fase 0: Documentación ✅

CLAUDE.md + `docs/`. Sin código de aplicación.

## Fase 1: Fundaciones

- [ ] Dependencias: `@fastify/type-provider-zod`, `zod`, `@fastify/{env,helmet,cors,rate-limit,under-pressure,sensible,swagger,swagger-ui}`, `fastify-plugin`, `vitest`, `undici`.
- [ ] `tsconfig`: agregar `types: ["node"]`, quitar `jsx`; separar `tsconfig.json` (typecheck de `src/`, `test/`, `prisma/`) de `tsconfig.build.json` (emite solo `src/`).
- [ ] Verificar que TypeScript 7 convive con Vitest y el resto del tooling; si algo necesita la API JS de TS, evaluar.
- [ ] Refactor `app.ts` → `buildApp(opts)`; `server.ts` con graceful shutdown (SIGINT/SIGTERM).
- [ ] `config/env.ts` con todas las variables de [API.md](API.md#variables-de-entorno) + `.env.example`.
- [ ] `plugins/security.ts`, `plugins/swagger.ts` (`/docs`), error handler en `lib/errors.ts`.
- [ ] Logger Pino con `redact`.
- [ ] Vitest + `test/helpers/build-app.ts`; test de `/health` y de `/docs/json`.
- [ ] Scripts `test`, `test:watch`, `test:coverage`, `typecheck`.

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

- [ ] `providers/llm.types.ts`, `groq.provider.ts`, `gemini.provider.ts` (JSON mode, timeout, mapeo de tokens).
- [ ] Tests de providers y failover con `MockAgent` (Groq 429 → Gemini; ambos caen → degradación).
- [ ] `prompt/system-prompt.ts` + `prompt/profile-context.ts` (experiencias paralelas marcadas, `clientPublic` respetado).
- [ ] `quota.service.ts` (derivado por `visitorId` y día + antiabuso + global diario) con tests unitarios de los bordes (`LIMIT - 1`, `LIMIT`, cambio de día en Córdoba, otro `visitorId`, lead capturado, `recruiterIntent` pegajoso).
- [ ] `chat.service.ts` + `POST /chat` (`visitorId`, `reason`, `contact`) + rate limit específico.
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

| Tema | Opciones / notas | Bloquea |
|---|---|---|
| **Hosting del Fastify** | Requisitos: proceso long-running (no serverless puro, por el tope en memoria), una instancia, HTTPS, env vars. Si el free tier duerme la instancia, se suma cold start y se reinicia el tope global (aceptable). Candidatos a evaluar: Render, Railway, Fly.io, Koyeb. | Fase 6 |
| **Proveedor de mail para leads** | Necesita API HTTP y free tier suficiente para pocos mails por día. Ojo: el destino es Hotmail/Outlook, que es estricto con la entregabilidad (dominio verificado, SPF/DKIM). Candidatos a evaluar: Resend, Brevo, Postmark, SMTP de Gmail. | Fase 5 |
| **Modelos concretos** | ID exacto del modelo de Groq y de Gemini Flash-Lite (`GROQ_MODEL`, `GEMINI_MODEL`); confirmar que ambos soportan JSON mode. | Fase 4 |
| **URL del portfolio** | Falta la URL de GitHub Pages: `Profile.portfolioUrl` y `CORS_ORIGIN`. | Fase 2 (seed) / Fase 6 |
| **DB de test** | Branch de Neon dedicado o Postgres local en Docker. Recomendación: Docker local para tests (rápido, offline, desechable) y Neon solo para dev/prod. | Fase 2 |
| **Retención de conversaciones** | Purgar conversaciones sin lead después de N días (¿90?). Las que tienen lead no se borran (`Restrict`). | Fase 8 |
| **Meses del título de grado** | "2017 a 2019" sin meses: se guarda `2017-01-01` / `2019-01-01` provisoriamente. | Fase 2 (seed) |
| **Vínculos faltantes del seed** | Ver "Para revisar" en [SEED-DATA.md](SEED-DATA.md): "SQL" genérico, tecnologías mencionadas en viñetas pero no en el stack, y tecnologías por formación. | Post fase 2 (por Postman) |
| **Datos de perfil sin cargar** | `availability` (null) y `level` / `yearsOfUse` de cada tecnología. | Post fase 2 (por Postman) |
