# portfolio-back

API REST del portfolio de Lisandro Córdoba. Dos propósitos:

1. **CV editable**: perfil, experiencias, tecnologías, formación e idiomas por CRUD (Postman/Swagger), sin redeploy.
2. **Chat con IA como embudo de conversión**: responde SOLO sobre el perfil profesional y, tras N consultas sustanciales por visitante y por día (`CHAT_QUERY_LIMIT`), muestra un CTA para que el reclutador deje sus datos.

El backend es también pieza de portfolio: estructura, documentación y tests tienen que estar a la altura.

**Estado**: fase 0 (documentación). `src/app.ts` todavía exporta una instancia singleton; en fase 1 pasa a `buildApp()`. Ver [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

- Node.js + TypeScript 7 (ESM, `module: NodeNext`), Fastify 5
- Zod 4 + `@fastify/type-provider-zod` (el oficial de la org fastify; **no** `fastify-type-provider-zod` de turkerdev)
- Prisma **7.10.x estable** (no el 8 RC que hoy figura como `latest` en npm) + PostgreSQL en Neon, con `@prisma/adapter-pg`
- Vitest + `app.inject()` + `MockAgent` de undici para el LLM
- `@fastify/swagger` + `@fastify/swagger-ui` en `/docs`
- `@fastify/helmet`, `cors`, `rate-limit`, `under-pressure`, `env`, `sensible`
- LLM: Groq (principal) → Gemini Flash-Lite (fallback), ambos vía `fetch` nativo, sin SDKs
- Pino (el de Fastify) con `redact`
- Gestor de paquetes: **yarn**

## Comandos

| Comando | Estado |
|---|---|
| `yarn dev` (tsx watch) / `yarn build` (tsc) / `yarn start` | existen |
| `yarn test`, `yarn test:watch`, `yarn test:coverage` | fase 1 |
| `yarn typecheck` (`tsc --noEmit`) | fase 1 |
| `yarn db:generate`, `yarn db:migrate`, `yarn db:deploy`, `yarn db:seed`, `yarn db:studio` | fase 2 |

Antes de dar algo por terminado: `yarn typecheck && yarn test`.

## Estructura (detalle y porqués en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))

```
src/app.ts            buildApp(): registra plugins y módulos. NO hace listen
src/server.ts         listen + graceful shutdown
src/config/env.ts     schema de @fastify/env
src/plugins/          security, swagger, auth, prisma (fastify-plugin)
src/modules/<feature>/  <feature>.routes|service|repository|schemas|test.ts
src/lib/              errors, types, prisma
src/generated/prisma/ cliente Prisma generado (gitignored)
prisma/               schema.prisma, migrations/, seed.ts
test/helpers/         build-app.ts
```

## Convenciones

- Código, identificadores y commits en **inglés**. Docs y textos del bot en **español**.
- Imports relativos con extensión `.js` (NodeNext). Nada de `any`; preferí `unknown` + parseo con Zod.
- Archivos por feature: `experience.routes.ts`, `experience.service.ts`, etc. Tests colocados al lado (`experience.test.ts`).
- Dependencias explícitas: factories `createXRepository(prisma)` → `createXService(repo)`, compuestas en `buildApp()` y pasadas a las rutas por opciones del plugin. Sin contenedor de DI.
- Schemas Zod **escritos a mano**. Enums importados desde `src/generated/prisma/enums`. Un schema de respuesta **pública** y otro **admin** por recurso: el público es la última barrera contra fugas de campos.
- Toda variable de entorno se lee desde `app.config` (validada por `@fastify/env`). Nunca `process.env` suelto fuera de `config/` y `server.ts`.
- Errores de Prisma se traducen a errores de dominio (`lib/errors.ts`) **dentro del repository**.
- Updates parciales con `PATCH`. Fechas de CV con precisión de mes (día 1).
- Providers de LLM: usan `fetch` (no SDK) para que `MockAgent` los intercepte en tests. Ningún test le pega a una API real.

## Reglas que nunca se rompen

1. **Las API keys de LLM viven solo en env vars del servidor.** Nada que llegue al navegador (el front es estático en GitHub Pages) puede contener secretos.
2. **El teléfono lo entrega el backend, nunca el LLM, y solo tras capturar el lead.** Vive en `Profile.phone` (solo admin, cargado por `PATCH`). No va al seed, ni al prompt/contexto del bot, ni a `GET /profile`. El número real no va a ningún archivo del repo; en tests, uno ficticio. Ver ADR-021.
3. **`app.ts` no hace `listen`.** Solo `server.ts`.
4. **Los repositories aíslan Prisma.** Services y routes no importan `PrismaClient` ni tipos de query de Prisma.
5. **El contador de consultas se deriva** (`count` de mensajes USER con `substantive = true` del `visitorId`, en el día de Córdoba). Nunca un campo incrementado a mano.
6. **No inventar datos del CV.** Ni en seed, ni en fixtures, ni en el prompt. Si falta un dato, se pregunta. Fuente: [docs/SEED-DATA.md](docs/SEED-DATA.md).
7. **Lo no publicado no sale**: `published = false` no aparece en respuestas públicas ni en el contexto del bot.
8. **Mutaciones y lecturas `/admin/*` requieren `x-admin-key`.** Únicas mutaciones públicas: `POST /chat` y `POST /leads` (con rate limit).
9. **La IP nunca se guarda en claro**: HMAC-SHA256 con `IP_HASH_SALT`.
10. **Logs**: `redact` de `x-admin-key`, `authorization` y API keys. La key de Gemini va por header, nunca por query string.

## Subagentes (`.claude/agents/`)

- **`tech-lead`** (opus): decisiones de diseño, dudas de "por qué" o "cuál conviene", y revisión de código antes de dar algo por cerrado. Explica el razonamiento y toma posición; no escribe la implementación por vos.
- **`qa-engineer`** (sonnet): después de implementar o tocar un módulo, para escribir sus tests, diagnosticar un test que falla o evaluar si la cobertura alcanza. Prioriza bordes, auth, fallos del LLM y contratos sobre el porcentaje.

Flujo típico de una feature: diseño con `tech-lead` → implementación → tests con `qa-engineer` → revisión con `tech-lead`.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): carpetas, porqués, flujo de un request
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md): modelos, relaciones, order/published, many-to-many
- [docs/CHAT-FLOW.md](docs/CHAT-FLOW.md): embudo, contrato de `POST /chat`, conteo, privacidad del bot
- [docs/API.md](docs/API.md): endpoints
- [docs/DECISIONS.md](docs/DECISIONS.md): ADRs
- [docs/ROADMAP.md](docs/ROADMAP.md): fases y pendientes
- [docs/SEED-DATA.md](docs/SEED-DATA.md): datos reales del CV para `prisma/seed.ts`
