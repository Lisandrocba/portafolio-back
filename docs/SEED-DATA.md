# Datos del seed

Fuente única y **textual** para `prisma/seed.ts`. Los provee Lisandro. **No inventar ni completar nada que no esté acá**: lo que falta va `null` y se carga después por Postman.

**Nunca** agregar el teléfono real, ni acá ni en ningún otro lado del repo. `Profile.phone` existe pero se carga a mano por `PATCH /profile` (ADR-021); el seed lo deja `null`.

## Profile

| Campo | Valor |
|---|---|
| `fullName` | Lisandro Córdoba |
| `headline` | Desarrollador Full Stack \| React \| Node.js \| TypeScript |
| `location` | Cosquín, Córdoba, Argentina |
| `email` | lisandrocba_7@hotmail.com |
| `linkedinUrl` | https://www.linkedin.com/in/lisandrocordoba |
| `githubUrl` | https://github.com/Lisandrocba |
| `portfolioUrl` | `null` (pendiente: URL de GitHub Pages) |
| `openToOffers` | `true` |
| `workModes` | `[REMOTE, HYBRID, ONSITE]` |
| `availability` | `null` (a cargar por Postman) |

`summary`:

> Desarrollador Full Stack con más de 4 años de experiencia construyendo aplicaciones web de punta a punta, tanto en equipos de producto como de forma freelance. Buena base en frontend con React, TypeScript y Next.js, incluyendo Design Systems, librerías de componentes y testing con Jest y React Testing Library. Experiencia en backend desarrollando APIs REST con Node.js y Express, y modelando datos con PostgreSQL, MongoDB y Prisma. Acostumbrado a llevar proyectos freelance de punta a punta: relevamiento, arquitectura, desarrollo, despliegue y comunicación con clientes. Cómodo trabajando con herramientas de desarrollo asistido por IA (Claude Code, GitHub Copilot CLI, MCP) para acelerar la entrega sin resignar calidad de código.

## Languages

| order | name | level | detail |
|---|---|---|---|
| 1 | Español | `NATIVE` | `null` |
| 2 | Inglés | `BASIC` | competencia básica profesional |

## Experiences

Regla de carga: **la primera viñeta va a `description`**, el resto a `highlights` (en orden). La línea "Stack" no es highlight: define los vínculos con Technology. Todas `published = true`, `clientPublic = true`.

**Las experiencias 1 y 2 son simultáneas** (ambas con `endDate = null`). No son consecutivas.

### 1. Caramel Point (order 1)

- `role`: Desarrollador Frontend (React / TypeScript)
- `company`: Caramel Point
- `client`: Banco de Córdoba (público, sin NDA, confirmado)
- `startDate`: 2025-09-01 · `endDate`: `null`
- `location`: Córdoba, Argentina · `modality`: `HYBRID`
- `description`: Desarrollo de funcionalidades con React y TypeScript en 3 productos/equipos de un cliente bancario, en aplicaciones enterprise construidas en monorepos que consumen múltiples microservicios.
- `highlights`:
  1. Mantenimiento y evolución del Design System / librería de componentes compartida entre proyectos.
  2. Custom hooks para manejo de estado y lógica de negocio.
  3. Implementación de interfaces desde Figma, validadas junto al equipo de diseño.
  4. Tests unitarios y de integración con Jest y React Testing Library; mocks generados con contract testing para desacoplar el frontend del backend.
  5. Uso de Claude Code y GitHub Copilot CLI con planes de trabajo, skills y subagentes para acelerar refactors, generación de tests y revisión de código.
  6. Rotación entre equipos según la necesidad del proyecto.
  7. Logro: trabajé en librerías cross-proyecto para aportar reglas de desarrollo y prevenir errores de testing y de análisis estático (Sonar).
- Stack: React, TypeScript, Monorepo, Microservicios, Design System, Jest, React Testing Library, Contract Testing, Figma, Git.

### 2. Freelance (order 2)

- `role`: Desarrollador Full Stack
- `company`: Freelance (Workana y clientes directos)
- `client`: `null`
- `startDate`: 2022-01-01 · `endDate`: `null`
- `location`: Córdoba, Argentina · `modality`: `REMOTE`
- `description`: Proyectos de punta a punta: relevamiento de requerimientos, diseño de la solución, desarrollo, despliegue y soporte.
- `highlights`:
  1. Aplicaciones web con React, Next.js y TypeScript.
  2. APIs REST con Node.js y Express; modelado de datos con PostgreSQL, MongoDB y Prisma.
  3. Integración de APIs de LLMs (OpenAI) en productos para asistentes conversacionales y automatización de procesos.
  4. Flujo de trabajo asistido por IA (Claude Code, Copilot CLI, conectores MCP) con un plan de trabajo por feature y skills reutilizables.
  5. Comunicación directa con clientes: estimaciones, entregas iterativas y soporte.
  6. Proyecto destacado: sistema para una consultora de RRHH, para la administración de búsquedas, candidatos y ruta de procesos.
- Stack: React, Next.js, TypeScript, Node.js, Express, PostgreSQL, MongoDB, Prisma, Claude Code, MCP.

### 3. Mindfactory (order 3)

- `role`: Desarrollador Full Stack
- `company`: Mindfactory
- `client`: `null`
- `startDate`: 2024-07-01 · `endDate`: 2025-09-01
- `location`: Córdoba, Argentina · `modality`: `HYBRID`
- `description`: Los primeros 6 meses enfocado en backend, luego también en frontend.
- `highlights`:
  1. Backend: desarrollo y optimización de APIs con Node.js y TypeScript; aporte en decisiones de arquitectura escalable.
  2. Frontend: interfaces con React, Next.js y Vue (JavaScript/TypeScript), implementadas a partir de diseños en Figma.
  3. Tests unitarios con Jest.
- Stack: React, Next.js, Vue, JavaScript, TypeScript, Node.js, Express, MongoDB, SQL, Jest, Figma.

### 4. Rankerfy (order 4)

- `role`: Desarrollador Full Stack
- `company`: Rankerfy
- `client`: `null`
- `startDate`: 2023-11-01 · `endDate`: 2024-07-01
- `location`: España · `modality`: `REMOTE`
- `description`: Desarrollo y evolución de la aplicación web, con foco en interfaces dinámicas, accesibles y escalables, y en APIs y servicios backend.
- `highlights`:
  1. Frontend: componentes reutilizables con React y TypeScript, documentados con Storybook.
  2. Backend: APIs y servicios con Node.js, Express y TypeScript.
  3. Tests unitarios con Jest en frontend y backend.
  4. Trabajo en equipo ágil con seguimiento de sprints en Jira.
- Stack: React, TypeScript, Node.js, Express, MongoDB, SQL, Storybook, Jest, Jira.

### 5. Softnik (order 5)

- `role`: Desarrollador Frontend
- `company`: Softnik
- `client`: `null`
- `startDate`: 2023-01-01 · `endDate`: 2023-11-01
- `location`: Córdoba, Argentina · `modality`: `REMOTE`
- `description`: Sistema personalizado de gestión de horarios para empleados: registro de personal, definición de días/horarios y validación de asistencia por geolocalización (GPS) al ingreso y egreso.
- `highlights`:
  1. Interfaces intuitivas y responsivas con React, JavaScript y SCSS.
  2. Pruebas automatizadas con Jest y React Testing Library.
  3. Entorno ágil (Scrum) con Jira y GitLab.
- Stack: React, JavaScript, SCSS, Jest, React Testing Library, GitLab, Jira, Scrum.

## Technologies

Todas: `level = INTERMEDIATE` (**provisorio**, con comentario `// TODO: revisar nivel, se carga por Postman`), `yearsOfUse = null`, `published = true`. `order` = posición dentro de la categoría.

| Categoría | Tecnologías (en orden) |
|---|---|
| `BACKEND` | Node.js, Express.js, APIs REST, PostgreSQL, MongoDB, Prisma, Microsoft SQL Server |
| `FRONTEND` | React, React Hooks, Next.js, TypeScript, JavaScript, Vue.js, HTML, CSS, SCSS, Tailwind CSS |
| `ARCHITECTURE` | Microservicios, Monorepo, Design Systems, Librerías de Componentes, Principios SOLID, Diseño de APIs REST |
| `TESTING` | Jest, React Testing Library, Contract Testing |
| `TOOLING` | Git, GitHub, GitLab, Docker, Jira, Scrum/Ágil, **Figma**, **Storybook** |
| `AI` | Claude Code, GitHub Copilot CLI, Conectores MCP, Integración de APIs de OpenAI |

Figma y Storybook se agregaron (confirmado) porque aparecen en los stacks de las experiencias.

### Mapeo "Stack" de la experiencia → Technology.name

| Texto en el stack | Technology |
|---|---|
| Express | Express.js |
| Vue | Vue.js |
| Design System | Design Systems |
| MCP | Conectores MCP |
| Scrum | Scrum/Ágil |
| SQL | **sin vincular** (ambiguo: no se sabe si es Microsoft SQL Server, PostgreSQL u otro) |
| resto | mismo nombre |

### Vínculos Experience ↔ Technology resultantes

| Experiencia | Technologies |
|---|---|
| Caramel Point | React, TypeScript, Monorepo, Microservicios, Design Systems, Jest, React Testing Library, Contract Testing, Figma, Git |
| Freelance | React, Next.js, TypeScript, Node.js, Express.js, PostgreSQL, MongoDB, Prisma, Claude Code, Conectores MCP |
| Mindfactory | React, Next.js, Vue.js, JavaScript, TypeScript, Node.js, Express.js, MongoDB, Jest, Figma |
| Rankerfy | React, TypeScript, Node.js, Express.js, MongoDB, Storybook, Jest, Jira |
| Softnik | React, JavaScript, SCSS, Jest, React Testing Library, GitLab, Jira, Scrum/Ágil |

## Education

Todas `published = true`, `inProgress = false`, `certificateUrl = null`, `hours = null`, **sin tecnologías vinculadas** (las carga el dueño).

| order | type | title | institution | startedAt | completedAt |
|---|---|---|---|---|---|
| 1 | `DEGREE` | Programador (Técnico en Programación) | Universidad Tecnológica Nacional, Facultad Regional Córdoba | 2017-01-01 ⚠️ | 2019-01-01 ⚠️ |
| 2 | `CERTIFICATION` | Curso de Diseño UX/UI | UTN Buenos Aires | `null` | 2025-10-01 |
| 3 | `CERTIFICATION` | Desarrollador Full Stack | Coderhouse | `null` | 2022-09-01 |
| 4 | `CERTIFICATION` | Desarrollador React Native | Coderhouse | `null` | 2022-06-01 |
| 5 | `CERTIFICATION` | Desarrollador Front End | Coderhouse | `null` | 2021-09-01 |
| 6 | `COURSE` | JavaScript de Cero a Experto | Udemy | `null` | 2021-06-01 |

⚠️ Solo se conoce el año. Día y mes provisorios; la presentación del título de grado debería mostrar solo años.

## Para revisar por Postman después del seed

- `level` y `yearsOfUse` de las 38 tecnologías.
- `Profile.availability` y `Profile.portfolioUrl`.
- "SQL" en los stacks de Mindfactory y Rankerfy: vincular la tecnología que corresponda.
- Tecnologías que aparecen en **viñetas** pero no en la línea "Stack" (no se vincularon para no inferir): GitHub Copilot CLI (Caramel Point, Freelance), Integración de APIs de OpenAI (Freelance), Sonar (Caramel Point; no existe como Technology).
- Tecnologías de cada formación.
