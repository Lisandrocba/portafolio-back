# API

Documentación interactiva generada desde los schemas Zod: **`/docs`** (Swagger UI). Este archivo es el plan; si difiere de `/docs`, manda `/docs`.

## Convenciones

- JSON en request y response. Fechas en ISO 8601. Las fechas del CV tienen precisión de mes (`2025-09-01`).
- **Auth admin**: header `x-admin-key: <ADMIN_API_KEY>`. Sin header o con key inválida → `401`.
- **Público** = sin auth. Los endpoints públicos devuelven solo lo publicado (`published = true`) y con el schema público (sin `published`, `createdAt`, `updatedAt`, y sin `client` si `clientPublic = false`).
- **Admin** = schema completo, incluye lo no publicado.
- Updates parciales con `PATCH`. `technologyIds` reemplaza el set completo de vínculos.
- Listas ordenadas por `order` asc.
- Errores: `{ statusCode, error, message, details? }`. Detalle en [ARCHITECTURE.md](ARCHITECTURE.md#manejo-de-errores).

Leyenda: 🌐 público · 🔒 admin (`x-admin-key`)

## Sistema

|     | Método | Path         | Devuelve                                                              |
| --- | ------ | ------------ | --------------------------------------------------------------------- |
| 🌐  | GET    | `/health`    | `{ status: "ok" }` (under-pressure; 503 si el servidor está saturado) |
| 🌐  | GET    | `/docs`      | Swagger UI                                                            |
| 🌐  | GET    | `/docs/json` | OpenAPI JSON                                                          |

## Perfil e idiomas — `modules/profile`

|     | Método | Path                     | Devuelve                                                                 |
| --- | ------ | ------------------------ | ------------------------------------------------------------------------ |
| 🌐  | GET    | `/profile`               | Perfil + `yearsOfExperience` (derivado) + `languages[]`. **Sin `phone`** |
| 🔒  | GET    | `/admin/profile`         | Perfil con schema completo (incluye `phone`)                             |
| 🔒  | PATCH  | `/profile`               | Perfil actualizado (upsert del singleton). Acepta `phone`                |
| 🔒  | POST   | `/profile/languages`     | `201` Language creado                                                    |
| 🔒  | PATCH  | `/profile/languages/:id` | Language actualizado                                                     |
| 🔒  | DELETE | `/profile/languages/:id` | `204`                                                                    |

## Experiencias — `modules/experience`

|     | Método | Path                 | Devuelve                                                                               |
| --- | ------ | -------------------- | -------------------------------------------------------------------------------------- |
| 🌐  | GET    | `/experiences`       | Experiencias publicadas, con `technologies[]` (`id`, `name`, `category`) e `isCurrent` |
| 🌐  | GET    | `/experiences/:id`   | Una experiencia publicada (`404` si no existe o no está publicada)                     |
| 🔒  | GET    | `/admin/experiences` | Todas, schema completo                                                                 |
| 🔒  | POST   | `/experiences`       | `201` creada. Body acepta `technologyIds[]`                                            |
| 🔒  | PATCH  | `/experiences/:id`   | Actualizada                                                                            |
| 🔒  | DELETE | `/experiences/:id`   | `204`                                                                                  |

## Tecnologías — `modules/technologies`

|     | Método | Path                              | Devuelve                                                                  |
| --- | ------ | --------------------------------- | ------------------------------------------------------------------------- |
| 🌐  | GET    | `/technologies?category=FRONTEND` | Publicadas, filtrables por categoría                                      |
| 🌐  | GET    | `/technologies/:id`               | Tecnología + **dónde se usó**: `experiences[]` y `education[]` publicadas |
| 🔒  | GET    | `/admin/technologies`             | Todas, schema completo                                                    |
| 🔒  | POST   | `/technologies`                   | `201` creada (`409` si `name` ya existe)                                  |
| 🔒  | PATCH  | `/technologies/:id`               | Actualizada. Caso típico: cargar `level` y `yearsOfUse`                   |
| 🔒  | DELETE | `/technologies/:id`               | `204` (borra también los vínculos)                                        |

## Formación — `modules/education`

|     | Método | Path                            | Devuelve                                    |
| --- | ------ | ------------------------------- | ------------------------------------------- |
| 🌐  | GET    | `/education?type=CERTIFICATION` | Publicada, filtrable por `type`             |
| 🌐  | GET    | `/education/:id`                | Una publicada, con `technologies[]`         |
| 🔒  | GET    | `/admin/education`              | Toda, schema completo                       |
| 🔒  | POST   | `/education`                    | `201` creada. Body acepta `technologyIds[]` |
| 🔒  | PATCH  | `/education/:id`                | Actualizada                                 |
| 🔒  | DELETE | `/education/:id`                | `204`                                       |

## Chat — `modules/chat`

|     | Método | Path                                             | Devuelve                                                                                                                                        |
| --- | ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 🌐  | POST   | `/chat`                                          | `{ visitorId, conversationId, reply, remaining, showCta, reason, contact }`. Siempre 200, incluso con el LLM caído (`reason` distingue el caso) |
| 🔒  | GET    | `/admin/conversations?from&to&hasLead&visitorId` | Lista paginada: `id`, `visitorId`, `createdAt`, `lastSeenAt`, `userMessages`, `substantiveMessages`, `hasLead`                                  |
| 🔒  | GET    | `/admin/conversations/:id`                       | Conversación con todos sus mensajes (incluye `substantive`, `recruiterIntent`, `provider`, `tokensUsed`)                                        |

Contrato completo, reglas de conteo y errores de `POST /chat`: [CHAT-FLOW.md](CHAT-FLOW.md#contrato-de-post-chat).

Rate limit específico de `POST /chat`: 10 req/min por IP (valor inicial, configurable).

## Leads — `modules/leads`

|     | Método | Path                           | Devuelve                                                                                                                                               |
| --- | ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🌐  | POST   | `/leads`                       | `201 { id, contact: { email, linkedinUrl, phone } }`. `404` si la conversación no existe, `409` si ya tiene lead. El honeypot responde 201 sin `phone` |
| 🔒  | GET    | `/admin/leads?contacted=false` | Lista de leads (más nuevos primero)                                                                                                                    |
| 🔒  | GET    | `/admin/leads/:id`             | Lead + **conversación completa**                                                                                                                       |
| 🔒  | PATCH  | `/admin/leads/:id`             | Marcar `contactedAt`                                                                                                                                   |
| 🔒  | POST   | `/admin/leads/:id/notify`      | Reintenta el mail de notificación (para leads con `notifiedAt = null`)                                                                                 |

Rate limit específico de `POST /leads`: 3 req/hora por IP (valor inicial).

## Por qué hay rutas `/admin/*`

La regla general es "GET públicos, mutaciones protegidas". Hay dos excepciones con motivo:

- **Lecturas sensibles** (leads, conversaciones) o **completas** (CV con lo no publicado): no pueden ser GET públicos. Van bajo `/admin` con un schema de respuesta distinto. Así cada ruta tiene un único schema y Swagger lo documenta sin ambigüedad.
- **Mutaciones públicas**: `POST /chat` y `POST /leads` las hace el visitante. Las compensan el rate limit, la validación estricta y el honeypot.

Ver ADR-008 en [DECISIONS.md](DECISIONS.md).

## Variables de entorno

| Variable                          | Default              | Uso                                                             |
| --------------------------------- | -------------------- | --------------------------------------------------------------- |
| `NODE_ENV`                        | `development`        | `development` / `test` / `production`                           |
| `HOST` / `PORT`                   | `127.0.0.1` / `3000` | En producción `0.0.0.0`                                         |
| `TRUST_PROXY`                     | `false`              | `true` detrás del proxy del hosting                             |
| `LOG_LEVEL`                       | `info`               |                                                                 |
| `DATABASE_URL`                    | —                    | Neon, conexión pooled (runtime)                                 |
| `DIRECT_DATABASE_URL`             | —                    | Neon, conexión directa (migraciones, vía `prisma.config.ts`)    |
| `CORS_ORIGIN`                     | —                    | Lista separada por comas (URL del portfolio + localhost en dev) |
| `ADMIN_API_KEY`                   | —                    | Mínimo 32 caracteres                                            |
| `IP_HASH_SALT`                    | —                    | Secreto para el HMAC de IPs                                     |
| `GROQ_API_KEY` / `GROQ_MODEL`     | —                    | Provider principal                                              |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | —                    | Fallback (Flash-Lite)                                           |
| `LLM_TIMEOUT_MS`                  | `15000`              | Timeout por provider antes del failover                         |
| `CHAT_QUERY_LIMIT`                | `5`                  | Consultas sustanciales por visitante por día antes del CTA      |
| `CHAT_HARD_MESSAGE_LIMIT`         | `20`                 | Mensajes USER totales por visitante por día (antiabuso)         |
| `CHAT_DAILY_GLOBAL_LIMIT`         | `300`                | Requests al LLM por día, global, en memoria                     |
| `CHAT_MAX_MESSAGE_CHARS`          | `500`                | Largo máximo del mensaje                                        |
| `CHAT_HISTORY_WINDOW`             | `10`                 | Mensajes previos que se envían al LLM                           |
| `LEAD_NOTIFY_EMAIL`               | —                    | `lisandrocba_7@hotmail.com`                                     |
| `MAIL_*`                          | —                    | Pendiente según proveedor de mail                               |
| `SEED_FORCE`                      | `false`              | Solo para `yarn db:seed`                                        |

Los defaults numéricos son valores iniciales razonables, para ajustar con datos reales.
