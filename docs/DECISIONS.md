# Decisiones de arquitectura (ADRs)

Formato: **Contexto** / **Decisión** / **Alternativa descartada** / **Consecuencia**. Estado "Aceptada" salvo indicación.

---

## ADR-001: Organización por features (vertical slices)

- **Contexto**: la API tiene dominios claros (perfil, experiencia, tecnologías, formación, chat, leads) que cambian por separado.
- **Decisión**: una carpeta por feature con `routes`, `service`, `repository`, `schemas` y `test` juntos.
- **Alternativa descartada**: carpetas por capa técnica (`controllers/`, `services/`, `repositories/`). Un cambio en "experiencias" tocaría 4 carpetas y el acoplamiento entre features queda escondido.
- **Consecuencia**: cada feature se entiende y se testea aislada. Lo compartido de verdad va a `lib/` y `plugins/`; si algo de un módulo lo usa otro, se pasa por parámetro (ver ADR-014).

## ADR-002: `buildApp()` sin `listen`

- **Contexto**: los tests de integración tienen que ejercitar rutas, validación, auth y serialización reales.
- **Decisión**: `app.ts` exporta `buildApp(opts)`. Solo `server.ts` hace `listen` y el graceful shutdown.
- **Alternativa descartada**: instancia singleton que hace `listen` al importarse (como el `app.ts` actual). Obliga a abrir puertos en tests y comparte estado entre ellos.
- **Consecuencia**: tests con `app.inject()` en memoria, cada uno con su instancia. El `app.ts` actual se refactoriza en fase 1.

## ADR-003: Los repositories aíslan Prisma

- **Contexto**: Prisma filtra tipos y errores propios (`PrismaClientKnownRequestError`) hacia arriba si no se contiene.
- **Decisión**: solo los repositories importan el cliente de Prisma. Traducen `P2025` → `NotFoundError` y `P2002` → `ConflictError`. Services y routes no conocen Prisma.
- **Alternativa descartada**: services que usan `prisma.x.findMany` directo. Menos archivos, pero la lógica de negocio queda atada al ORM y los tests unitarios requieren DB.
- **Consecuencia**: services testeables con repos falsos; un archivo más por feature.

## ADR-004: Interfaz común de LLM y failover por loop

- **Contexto**: se usa la cuota gratuita de Groq, que puede agotarse o caerse. Hay un fallback (Gemini Flash-Lite).
- **Decisión**: `llm.types.ts` define `LlmProvider { name; complete(req): Promise<LlmResult> }`. `chat.service` recibe un array ordenado y lo recorre hasta que uno responde. Implementación con `fetch` nativo, sin SDKs. La key de Gemini va por header (`x-goog-api-key`), no por query string.
- **Alternativa descartada**: SDKs oficiales (`openai`, `@google/genai`) o librerías de orquestación (LangChain, Vercel AI SDK). Más dependencias para dos POST, y complican interceptar con `MockAgent`.
- **Consecuencia**: agregar un provider = un archivo + sumarlo al array. Tests de failover deterministas con `MockAgent`. Cada provider mapea su formato (JSON mode, conteo de tokens) a `LlmResult`.

## ADR-005: Contexto del bot leído de los services en cada request

- **Contexto**: el CV se edita por Postman y el bot tiene que reflejarlo sin redeploy.
- **Decisión**: `profile-context.ts` llama a los services del CV en cada `POST /chat`, con los mismos filtros que la API pública.
- **Alternativa descartada**: (a) prompt estático en el código: requiere redeploy; (b) caché con TTL: introduce ventanas donde el bot dice algo distinto al portfolio.
- **Consecuencia**: 5 queries chicas por mensaje (`Promise.all`), despreciables al lado de la latencia del LLM. Lo no publicado nunca llega al prompt.

## ADR-006: Schemas Zod a mano, enums del cliente generado

- **Contexto**: los schemas definen el contrato público y generan el OpenAPI.
- **Decisión**: schemas escritos a mano, separados en input / público / admin. Enums importados del cliente generado por Prisma 7 (`src/generated/prisma/enums`).
- **Alternativa descartada**: `zod-prisma-types`. Replica la tabla 1:1 y filtra campos internos (`published`, timestamps, `client`) a la API.
- **Consecuencia**: más código, pero el contrato es explícito y la DB puede cambiar sin romper la API. **Ajuste respecto del plan original**: con Prisma 7 los enums ya no se importan desde `@prisma/client` sino desde la ruta `output` del generator.

## ADR-007: Contador de consultas derivado

- **Contexto**: hay que saber cuántas consultas sustanciales lleva un visitante hoy (el alcance por visitante y día está en ADR-022).
- **Decisión**: `count(Message where role = USER and substantive = true and conversation.visitorId = V and createdAt >= inicio del día en Córdoba)`. Sin campo contador.
- **Alternativa descartada**: `Conversation.queryCount` (o un contador por visitante) incrementado a mano. Se desincroniza ante errores parciales, reintentos o borrados, y necesitaría un reset diario.
- **Consecuencia**: una query con índice por mensaje. Los mensajes son la única fuente de verdad, y el "reset" diario sale gratis del filtro por fecha.

## ADR-008: Auth admin por header y rutas `/admin/*`

- **Contexto**: un solo administrador (el dueño), que edita desde Postman/Swagger. No hay usuarios.
- **Decisión**: header `x-admin-key` comparado en tiempo constante, aplicado como `preHandler` (`app.requireAdmin`). GET públicos y mutaciones protegidas, con dos excepciones: (1) lecturas sensibles o completas (leads, conversaciones, CV con lo no publicado) bajo `/admin/*`; (2) `POST /chat` y `POST /leads` públicos, con rate limit.
- **Alternativa descartada**: JWT/sesiones (no hay usuarios que loguear); `?includeUnpublished=true` en la misma ruta pública (una ruta con dos schemas de respuesta según auth, ambigua en Swagger).
- **Consecuencia**: simple y suficiente. Rotar la key = cambiar una env var. Si algún día hay más de un admin, se migra a auth real.

## ADR-009: API keys solo en el servidor

- **Contexto**: el front es estático en GitHub Pages. Todo lo que llega al navegador es público.
- **Decisión**: el front solo conoce la URL del backend. Las keys de LLM viven en env vars del servidor y se redactan en logs.
- **Alternativa descartada**: llamar al LLM desde el front con una key "restringida". Cualquiera la extrae y consume la cuota.
- **Consecuencia**: el backend es el único camino al LLM; ahí se aplican cuotas, reglas y logging.

## ADR-010: Clasificación del mensaje por salida JSON del mismo LLM

- **Contexto**: los saludos no deben descontar, y el bot tiene que poder avisar que detectó un reclutador. Pero `showCta` lo calcula el backend.
- **Decisión**: el LLM responde `{ reply, substantive, recruiterIntent }` en JSON mode, en la misma llamada. Se persisten `substantive` y `recruiterIntent` en el mensaje USER. Si el JSON no parsea: `substantive = true`, `recruiterIntent = false`.
- **Alternativa descartada**: (a) heurística por regex para saludos: frágil e insuficiente para detectar intención; (b) llamada clasificadora aparte: duplica latencia y cuota.
- **Consecuencia**: cero llamadas extra. El criterio vive en el system prompt y se ajusta sin tocar código. Ante fallas de formato, el sesgo es mostrar el CTA antes.

## ADR-011: Respuesta fija sin LLM al superar topes

- **Contexto**: al agotar la cuota del visitante (o la global, o si caen todos los providers), el visitante puede seguir escribiendo.
- **Decisión**: 200 con un texto fijo, `contact` y `showCta: true`, sin llamar al LLM. El caso concreto va en `reason` (ADR-023). Se persiste el mensaje USER (`substantive = false`) para que el dueño vea qué quiso preguntar.
- **Alternativa descartada**: `429`/`503`. Obliga al front a tratarlo como error y se siente como una puerta en la cara.
- **Consecuencia**: el embudo sigue funcionando incluso con el LLM caído. Los fallos se ven en logs, no en la UX.

## ADR-012: Tope diario global en memoria

- **Contexto**: hace falta un freno para la cuota del proveedor ante abuso o picos (borrar `localStorage` o mandar otro `visitorId` reinicia el tope por visitante).
- **Decisión**: contador en memoria, reinicio diario (zona `America/Argentina/Cordoba`). No persiste.
- **Alternativa descartada**: tabla en DB o Redis. Durabilidad innecesaria para un freno; perderlo en un reinicio no tiene costo.
- **Consecuencia**: supone **una instancia**. Escalar horizontalmente requiere moverlo a un store compartido.

## ADR-013: Prisma 7 estable con `@prisma/adapter-pg`

- **Contexto**: a la fecha, el dist-tag `latest` de `prisma` en npm apunta a `8.0.0-rc.31`; la última estable es `7.10.1`. Prisma 7 usa el generator `prisma-client` (con `output` obligatorio), `prisma.config.ts` y driver adapters.
- **Decisión**: fijar `prisma`, `@prisma/client` y `@prisma/adapter-pg` en `~7.10`. Cliente generado en `src/generated/prisma` (gitignored). Runtime con la URL pooled de Neon; migraciones con la URL directa.
- **Alternativa descartada**: (a) Prisma 8 RC: inestable para un proyecto que se muestra; (b) `@prisma/adapter-neon` (serverless/WebSocket): pensado para edge/serverless, y un servidor Fastify long-running no lo necesita.
- **Consecuencia**: instalar con versión explícita (`yarn add prisma@~7.10`), nunca `@latest`. Revisar Prisma 8 cuando salga estable.

## ADR-014: Composición explícita en `buildApp()`

- **Contexto**: `chat.service` necesita los services del CV; las rutas necesitan su service.
- **Decisión**: factories `createXRepository(prisma)` / `createXService(deps)`; `buildApp()` las compone y pasa el service a cada plugin de rutas por opciones.
- **Alternativa descartada**: (a) contenedor de DI (awilix, tsyringe): magia innecesaria para ~8 services; (b) decorar todo en la instancia (`app.experienceService`): acopla a Fastify y esconde dependencias.
- **Consecuencia**: el grafo de dependencias se lee en un solo archivo.

## ADR-015: `clientPublic` separado de `published`

- **Contexto**: se pidió que el cliente final de una experiencia se exponga "solo si published lo permite", pero `published` oculta la experiencia entera.
- **Decisión**: `Experience.clientPublic: Boolean` (default `true`). Si es `false`, la API pública y el contexto del bot omiten `client`.
- **Alternativa descartada**: reusar `published`. No permite mostrar la experiencia sin el cliente.
- **Consecuencia**: hoy Banco de Córdoba es público (confirmado, sin NDA). Si cambia, se apaga con un PATCH.

## ADR-016: `yearsOfExperience` derivado

- **Contexto**: un número fijo de años queda desactualizado.
- **Decisión**: se calcula desde el `startDate` más antiguo entre las experiencias publicadas (años completos). Se expone en `GET /profile` y en el contexto del bot.
- **Alternativa descartada**: campo editable en Profile.
- **Consecuencia**: con los datos actuales da 4. El resumen ("más de 4 años") es texto libre y se actualiza a mano.

## ADR-017: `PATCH` para updates parciales

- **Contexto**: el uso típico es editar un campo desde Postman (p. ej. `level` de una tecnología).
- **Decisión**: `PATCH` con body parcial validado por Zod (`schema.partial()`).
- **Alternativa descartada**: `PUT` con reemplazo completo. Obliga a mandar el recurso entero para cambiar un campo.
- **Consecuencia**: las mutaciones son POST / PATCH / DELETE.

## ADR-018: Fechas del CV con precisión de mes

- **Contexto**: el CV expresa fechas como "sept. 2025".
- **Decisión**: columnas `@db.Date` con día 1. La presentación (API y bot) usa mes y año.
- **Alternativa descartada**: strings libres ("Sept. 2025"): no se pueden ordenar ni calcular duraciones.
- **Consecuencia**: donde solo se conoce el año (título de grado 2017–2019) se guarda `YYYY-01-01` provisoriamente (ver pendientes).

## ADR-019: IP hasheada con HMAC

- **Contexto**: se necesita agrupar conversaciones por origen (abuso, métricas) sin guardar datos personales.
- **Decisión**: `ipHash = HMAC-SHA256(IP_HASH_SALT, ip)`.
- **Alternativa descartada**: SHA-256 sin secreto. El espacio de IPv4 es chico y se revierte por fuerza bruta.
- **Consecuencia**: sin el salt, el hash no se puede revertir. Rotar el salt rompe la agrupación histórica (aceptable).

## ADR-020: yarn como gestor de paquetes

- **Contexto**: el repo ya tiene `yarn.lock`.
- **Decisión**: yarn.
- **Alternativa descartada**: npm / pnpm (requería descartar el lock existente).
- **Consecuencia**: los scripts se documentan como `yarn <script>`.

## ADR-021: Teléfono entregado por el backend tras capturar el lead

- **Contexto**: el dueño quiere que un reclutador pueda obtener su teléfono, pero el chat es público y cualquier dato que el bot pueda decir queda expuesto a scrapers y a jailbreaks.
- **Decisión**: `Profile.phone` (nullable, solo admin, se carga por `PATCH /profile`, nunca en el seed). Lo entrega **el backend**, no el LLM: en la respuesta 201 de `POST /leads` y en `contact.phone` de `POST /chat` cuando el visitante ya tiene un lead. No entra a `GET /profile` ni al contexto del LLM.
- **Alternativa descartada**: (a) ponerlo en el contexto del bot: cualquiera lo obtiene preguntando o con un prompt injection, y una vez filtrado no se puede retirar; (b) no darlo nunca: pierde un canal que el dueño quiere ofrecer a leads reales.
- **Consecuencia**: el teléfono funciona como premio del embudo. Un lead falso lo obtiene igual: es fricción, no seguridad, y la acotan el rate limit de `POST /leads` y el honeypot (que responde sin teléfono). El número real nunca va al repo: ni seed, ni fixtures, ni docs.

## ADR-022: Tope de consultas por visitante (`visitorId`) y por día

- **Contexto**: con el tope por conversación, abrir otra pestaña o cerrar el navegador (`sessionStorage`) daba cuota nueva. Se quiere distinguir de dónde vienen las consultas sin crear usuarios.
- **Decisión**: el front genera un `visitorId` (UUID) y lo guarda en `localStorage`; se manda en cada `POST /chat` y se guarda en `Conversation.visitorId`. El tope cuenta las consultas sustanciales del visitante en el día calendario de `America/Argentina/Cordoba`. `recruiterIntent` y `leadCaptured` también se evalúan por visitante.
- **Alternativa descartada**: (a) tope por conversación: se evade con una pestaña nueva; (b) tope total sin renovación: un reclutador que vuelve otro día queda bloqueado para siempre; (c) usuarios con login: fricción que mata el embudo; (d) tope por `ipHash`: castiga a todos los que comparten IP (oficinas, NAT de operadoras).
- **Consecuencia**: el id es controlado por el cliente: borrar `localStorage` o mandar otro id da cuota nueva. Se acepta igual que antes; la protección real de la cuota del proveedor la dan el rate limit por IP y el tope diario global. Índice en `Conversation.visitorId`.

## ADR-023: `reason` en la respuesta de `POST /chat`

- **Contexto**: el front necesita distinguir "se te acabaron las consultas" de "el servicio de IA está caído" para mostrar mensajes y acciones distintas, sin dejar de tratar ambos como respuestas que convierten (ADR-011).
- **Decisión**: la respuesta siempre es 200 con `reason: "OK" | "QUERY_LIMIT" | "ABUSE_LIMIT" | "GLOBAL_LIMIT" | "LLM_UNAVAILABLE"` y `contact: { email, linkedinUrl, phone }`.
- **Alternativa descartada**: `503` cuando caen los providers. Es semánticamente correcto, pero el front tendría que leer el cuerpo de un error y separarlo del `503` de under-pressure, y el embudo pasaría a depender del camino de error.
- **Consecuencia**: el front hace un `switch` sobre `reason`, no sobre el texto ni el status. Agregar un caso nuevo es sumar un valor al enum del schema.
