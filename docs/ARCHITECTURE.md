# Arquitectura

## Principios

- **Vertical slices**: cada feature contiene sus rutas, lógica, acceso a datos, schemas y tests. Para cambiar "experiencias" se toca una carpeta.
- **Capas dentro del slice**: `routes → service → repository → Prisma`. Cada capa solo conoce a la de abajo.
- **Composición explícita**: `buildApp()` es la raíz de composición. Arma repositories, services y rutas pasando dependencias por parámetro. No hay singletons de dominio ni contenedor de DI.
- **Los schemas son el contrato**: Zod valida la entrada, serializa la salida y genera el OpenAPI de `/docs`. Un solo lugar de verdad.

## Estructura de carpetas

```
src/
  app.ts                    buildApp(opts?) → App. Valida env, registra todo, NO hace listen
  server.ts                 carga .env (si existe) + buildApp() + listen + graceful shutdown (SIGINT/SIGTERM → app.close(), con timeout)
  config/
    env.ts                  interfaz Env + schema (JSONSchemaType<Env>) + loadConfig() con env-schema; tipa app.config
    logger.ts               opciones de Pino: level, redact, serializer de req sin IP
  plugins/                  todos envueltos con fastify-plugin (comparten scope con la app)
    security.ts             helmet, cors, rate-limit (global), under-pressure, sensible
    swagger.ts              @fastify/swagger + swagger-ui en /docs; jsonSchemaTransform del type provider
    auth.ts                 decora app.requireAdmin (preHandler que valida x-admin-key)
    prisma.ts               crea PrismaClient con adapter-pg, decora app.prisma, $disconnect en onClose
  modules/
    health/                 GET /health (ruta propia con schema Zod, ver ADR-027)
    profile/                Profile (singleton) + Language
      profile.routes.ts
      profile.service.ts    incluye yearsOfExperience derivado
      profile.repository.ts
      profile.schemas.ts
      profile.test.ts
    experience/             mismos 5 archivos
    technologies/           mismos 5 archivos
    education/              mismos 5 archivos (DEGREE / CERTIFICATION / COURSE)
    chat/
      chat.routes.ts
      chat.service.ts       orquesta: conversación → cuota → prompt → providers → persistencia
      chat.repository.ts    Conversation + Message
      chat.schemas.ts       request/response de POST /chat, ChatReason, LlmOutputSchema
      chat.replies.ts       respuestas fijas sin LLM (es/en), por reason
      quota.service.ts      tope por visitante y día (derivado) + tope diario global (memoria)
      chat.test.ts
      quota.test.ts
      prompt/
        system-prompt.ts    reglas fijas del bot (privacidad, conversión, formato JSON)
        profile-context.ts  formatProfileContext(snapshot): función pura; chat.service le pasa los datos de los services del CV
        prompt.test.ts
      providers/
        llm.types.ts        interfaz LlmProvider + tipos de request/response
        llm.errors.ts       LlmProviderError con kind (timeout, rate_limit, server…)
        openai-compatible.provider.ts  una clase para Groq y Gemini (cambia la baseURL) + createLlmProviders(config)
        providers.test.ts
    leads/
      leads.routes.ts
      leads.service.ts      persiste el lead y dispara la notificación por mail
      leads.repository.ts
      leads.schemas.ts
      leads.test.ts
  lib/
    errors.ts               errores de dominio (NotFoundError, ConflictError…) + error handler
    types.ts                tipos compartidos (App = FastifyInstance con ZodTypeProvider)
    ip-hash.ts              createIpHasher(salt): HMAC-SHA256 de la IP
    not-implemented.ts      placeholder de los esqueletos; borrar cuando nada lo use
    prisma.ts               factory del PrismaClient (usada por plugins/prisma.ts y el seed)
  generated/prisma/         cliente generado por Prisma 7 (gitignored, se regenera con db:generate)
prisma/
  schema.prisma
  migrations/
  seed.ts
prisma.config.ts            config de Prisma 7 (URL directa para migraciones)
docker-compose.yml          Postgres de test (yarn test:db), puerto 5433, datos en tmpfs
test/
  global-setup.ts           una vez por corrida: prisma migrate deploy contra la DB de test
  setup.ts                  carga .env.test y se niega a correr contra una DB que no sea de test
  app.test.ts               env, /docs/json, forma de errores, headers de seguridad, CORS
  helpers/build-app.ts      buildTestApp(overrides): buildApp() con TEST_ENV
  helpers/database.ts       TEST_DATABASE_URL + resetDatabase(prisma): TRUNCATE de todas las tablas
  helpers/memory-chat-repository.ts  ChatRepository en memoria: fake para los tests de chat.service
  helpers/mock-llm.ts       installMockLlm(): MockAgent global + interceptores de Groq/Gemini
```

> `leads.repository.ts` no figuraba en la estructura original; se agrega para no romper la regla "los services no tocan Prisma".

## Por qué cada decisión

| Decisión                                           | Por qué                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.ts` no hace `listen`                          | `app.inject()` ejecuta requests en memoria sin abrir sockets. Tests rápidos, paralelos y sin puertos ocupados. `server.ts` es lo único que toca red.                             |
| `buildApp(opts)` acepta overrides                  | Los tests pueden pasar env propio. No hace falta mockear módulos con `vi.mock`.                                                                                                  |
| Plugins con `fastify-plugin`                       | Sin él, cada `register` crea un scope encapsulado y los decorators (`app.prisma`, `app.requireAdmin`) no serían visibles en los módulos.                                         |
| Repositories aíslan Prisma                         | Los services se testean con repos falsos. Cambiar de ORM o de query toca un archivo. Los errores `P2025`/`P2002` se traducen a dominio ahí mismo.                                |
| Factories en vez de clases singleton               | Las dependencias quedan visibles en la firma. `chat.service` recibe los services del CV por parámetro, sin importarlos.                                                          |
| Schemas de respuesta pública separados             | El serializer de Zod descarta las claves que no están en el schema. Aunque el repository devuelva `published`, `createdAt` o un campo nuevo, el schema público no lo deja salir. |
| Un provider compatible con OpenAI                  | Groq y Gemini hablan el mismo formato: una clase con el SDK `openai` y dos `baseURL`. El SDK usa el `fetch` global, así que `MockAgent` de undici lo intercepta igual (ADR-004). |
| `profile-context.ts` lee services, no repositories | Reusa los mismos filtros (`published`, `clientPublic`, orden) que la API pública. Lo que ve el bot = lo que ve el portfolio.                                                     |
| `quota.service.ts` separado                        | Concentra la lógica de negocio del embudo (límite, tope global, `showCta`). Se testea sin LLM ni HTTP.                                                                           |
| `src/generated/prisma`                             | Prisma 7 exige `output` explícito y ya no genera en `node_modules`. De ahí se importan cliente y enums.                                                                          |

## Orden de registro en `buildApp()`

1. `loadConfig()` **antes** de `Fastify()`: el nivel del logger y `trustProxy` son opciones del constructor. Después `app.decorate('config', config)` (ADR-026)
2. Type provider Zod: `setValidatorCompiler` / `setSerializerCompiler`
3. `plugins/security.ts` (helmet con CSP compatible con swagger-ui, cors, rate-limit, under-pressure, sensible)
4. `plugins/swagger.ts` (antes que las rutas, para que las capture)
5. `plugins/prisma.ts`, `plugins/auth.ts`
6. Error handler global (`lib/errors.ts`)
7. Composición: repositories → services → `register(routes, { prefix, service })` por módulo
8. `GET /health`: módulo `health` propio. La ruta de under-pressure declara JSON Schema y el serializer Zod lo rechaza (ADR-027)

## Flujo de un request de punta a punta

### Lectura pública: `GET /experiences`

```
cliente
  │
  ▼
onRequest ── helmet (headers) ── cors (origin = CORS_ORIGIN) ── rate-limit (por IP) ── under-pressure
  │
  ▼
router ── match GET /experiences
  │
  ▼
validación ── querystring contra Zod (400 si falla, con detalle)
  │
  ▼
handler ── experienceService.listPublic()
              └─ experienceRepository.findMany({ published: true, orderBy: order })
                    └─ Prisma → Postgres (Neon)
  │
  ▼
serialización ── ExperiencePublicSchema (descarta published, timestamps, client si !clientPublic)
  │
  ▼
onSend / onResponse ── log Pino (con redact) ── 200
```

### Mutación admin: `PATCH /technologies/:id`

```
onRequest (igual que arriba)
  → validación params + body (Zod)
  → preHandler: app.requireAdmin
        compara x-admin-key con ADMIN_API_KEY usando crypto.timingSafeEqual
        401 si falta o no coincide
  → handler → technologyService.update(id, data)
        → repository.update(...)    // P2025 → NotFoundError → 404
                                     // P2002 (name único) → ConflictError → 409
  → serialización con TechnologyAdminSchema → 200
```

### Chat: `POST /chat`

Detalle completo en [CHAT-FLOW.md](CHAT-FLOW.md). En resumen:

```
validación (message ≤ CHAT_MAX_MESSAGE_CHARS)
  → chatService.handle({ visitorId?, conversationId?, message, ip, userAgent, referrer })
      1. resolver visitante y conversación (ausente/inexistente → crear en silencio)
      2. quotaService: ¿lead ya capturado? ¿tope del visitante hoy? ¿tope diario global?
            si tope → respuesta fija sin LLM (reason QUERY_LIMIT / ABUSE_LIMIT / GLOBAL_LIMIT)
      3. profileContext.build()  ← services del CV (Promise.all)
      4. for (provider of providers) try provider.complete(...)   // failover
            si caen todos → respuesta fija (reason LLM_UNAVAILABLE)
      5. parsear salida JSON { reply, substantive, recruiterIntent }
      6. persistir USER + ASSISTANT en una transacción
      7. calcular remaining / showCta / contact
  → { visitorId, conversationId, reply, remaining, showCta, reason, contact }
```

## Manejo de errores

Forma única de error (la de Fastify):

```json
{ "statusCode": 404, "error": "Not Found", "message": "Experience not found" }
```

- Validación Zod → 400 con `details` (issues de Zod resumidos).
- `NotFoundError` → 404, `ConflictError` → 409, `UnauthorizedError` → 401.
- Cualquier otro error → 500 con mensaje genérico; el detalle va solo al log.
- El chat **no** devuelve 5xx si fallan todos los providers: degrada a una respuesta fija con CTA (ver CHAT-FLOW).

## Seguridad transversal

- `trustProxy` configurable por env: detrás del proxy del hosting hace falta para que `request.ip` sea la IP real (rate limit e `ipHash`).
- CORS restringido a `CORS_ORIGIN` (URL del portfolio en GitHub Pages + `localhost` en dev).
- Rate limit global + límites más estrictos en `POST /chat` y `POST /leads`.
- `under-pressure` devuelve 503 si el event loop se satura, en lugar de degradar todo.
- `x-admin-key` comparada en tiempo constante; mínimo 32 caracteres (validado en env).
