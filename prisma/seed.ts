import { existsSync } from 'node:fs';
import { createPrismaClient } from '../src/lib/prisma.js';
import type { Prisma } from '../src/generated/prisma/client.js';

/**
 * Loads the CV (and only the CV: never Conversation, Message or Lead) from docs/SEED-DATA.md.
 * Every value is copied verbatim from there: nothing invented, what's missing stays null.
 *
 * Doesn't overwrite edits made through the API: if the Profile already exists it aborts,
 * unless SEED_FORCE=true, which deletes and reloads the CV tables.
 *
 *   yarn db:seed                  # Neon, with the URLs from .env
 *   SEED_FORCE=true yarn db:seed  # reload over existing data
 */

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Like migrations, the seed uses the direct connection (not Neon's pooler).
const url = process.env.DIRECT_DATABASE_URL;
if (!url) {
  throw new Error('DIRECT_DATABASE_URL is required to run the seed');
}
const force = process.env.SEED_FORCE === 'true';

/** CV dates have month precision: always day 1 (ADR-018). */
const month = (yyyyMm: string) => new Date(`${yyyyMm}-01T00:00:00Z`);

const profile: Prisma.ProfileCreateInput = {
  id: 1,
  fullName: 'Lisandro Córdoba',
  headline: 'Desarrollador Full Stack | React | Node.js | TypeScript',
  summary:
    'Desarrollador Full Stack con más de 4 años de experiencia construyendo aplicaciones web de punta a punta, tanto en equipos de producto como de forma freelance. Buena base en frontend con React, TypeScript y Next.js, incluyendo Design Systems, librerías de componentes y testing con Jest y React Testing Library. Experiencia en backend desarrollando APIs REST con Node.js y Express, y modelando datos con PostgreSQL, MongoDB y Prisma. Acostumbrado a llevar proyectos freelance de punta a punta: relevamiento, arquitectura, desarrollo, despliegue y comunicación con clientes. Cómodo trabajando con herramientas de desarrollo asistido por IA (Claude Code, GitHub Copilot CLI, MCP) para acelerar la entrega sin resignar calidad de código.',
  location: 'Cosquín, Córdoba, Argentina',
  email: 'lisandrocba_7@hotmail.com',
  linkedinUrl: 'https://www.linkedin.com/in/lisandrocordoba',
  githubUrl: 'https://github.com/Lisandrocba',
  portfolioUrl: null, // pending: GitHub Pages URL
  openToOffers: true,
  workModes: ['REMOTE', 'HYBRID', 'ONSITE'],
  availability: null, // loaded later through the API
  // phone: never in the seed (rule 2, ADR-021). It's loaded by hand with PATCH /profile.
};

const languages: Prisma.LanguageCreateManyInput[] = [
  { order: 1, name: 'Español', level: 'NATIVE', detail: null },
  { order: 2, name: 'Inglés', level: 'BASIC', detail: 'competencia básica profesional' },
];

// TODO: revisar nivel, se carga por Postman. Every technology starts as INTERMEDIATE.
const technologiesByCategory: Record<Prisma.TechnologyCreateManyInput['category'], string[]> = {
  BACKEND: [
    'Node.js',
    'Express.js',
    'APIs REST',
    'PostgreSQL',
    'MongoDB',
    'Prisma',
    'Microsoft SQL Server',
  ],
  FRONTEND: [
    'React',
    'React Hooks',
    'Next.js',
    'TypeScript',
    'JavaScript',
    'Vue.js',
    'HTML',
    'CSS',
    'SCSS',
    'Tailwind CSS',
  ],
  ARCHITECTURE: [
    'Microservicios',
    'Monorepo',
    'Design Systems',
    'Librerías de Componentes',
    'Principios SOLID',
    'Diseño de APIs REST',
  ],
  TESTING: ['Jest', 'React Testing Library', 'Contract Testing'],
  TOOLING: ['Git', 'GitHub', 'GitLab', 'Docker', 'Jira', 'Scrum/Ágil', 'Figma', 'Storybook'],
  AI: ['Claude Code', 'GitHub Copilot CLI', 'Conectores MCP', 'Integración de APIs de OpenAI'],
};

const technologies: Prisma.TechnologyCreateManyInput[] = Object.entries(
  technologiesByCategory,
).flatMap(([category, names]) =>
  names.map((name, index) => ({
    name,
    category: category as Prisma.TechnologyCreateManyInput['category'],
    level: 'INTERMEDIATE' as const,
    yearsOfUse: null,
    order: index + 1, // position inside the category
    published: true,
  })),
);

/** Rule from SEED-DATA: the first bullet is the description, the rest are highlights. */
interface SeedExperience extends Omit<Prisma.ExperienceCreateInput, 'technologies'> {
  /** Technology names, already mapped ("Express" → "Express.js"; "SQL" left unlinked). */
  technologies: string[];
}

const experiences: SeedExperience[] = [
  {
    order: 1,
    role: 'Desarrollador Frontend (React / TypeScript)',
    company: 'Caramel Point',
    client: 'Banco de Córdoba',
    clientPublic: true,
    startDate: month('2025-09'),
    endDate: null,
    location: 'Córdoba, Argentina',
    modality: 'HYBRID',
    description:
      'Desarrollo de funcionalidades con React y TypeScript en 3 productos/equipos de un cliente bancario, en aplicaciones enterprise construidas en monorepos que consumen múltiples microservicios.',
    highlights: [
      'Mantenimiento y evolución del Design System / librería de componentes compartida entre proyectos.',
      'Custom hooks para manejo de estado y lógica de negocio.',
      'Implementación de interfaces desde Figma, validadas junto al equipo de diseño.',
      'Tests unitarios y de integración con Jest y React Testing Library; mocks generados con contract testing para desacoplar el frontend del backend.',
      'Uso de Claude Code y GitHub Copilot CLI con planes de trabajo, skills y subagentes para acelerar refactors, generación de tests y revisión de código.',
      'Rotación entre equipos según la necesidad del proyecto.',
      'Logro: trabajé en librerías cross-proyecto para aportar reglas de desarrollo y prevenir errores de testing y de análisis estático (Sonar).',
    ],
    published: true,
    technologies: [
      'React',
      'TypeScript',
      'Monorepo',
      'Microservicios',
      'Design Systems',
      'Jest',
      'React Testing Library',
      'Contract Testing',
      'Figma',
      'Git',
    ],
  },
  {
    order: 2,
    role: 'Desarrollador Full Stack',
    company: 'Freelance (Workana y clientes directos)',
    client: null,
    clientPublic: true,
    startDate: month('2022-01'),
    endDate: null,
    location: 'Córdoba, Argentina',
    modality: 'REMOTE',
    description:
      'Proyectos de punta a punta: relevamiento de requerimientos, diseño de la solución, desarrollo, despliegue y soporte.',
    highlights: [
      'Aplicaciones web con React, Next.js y TypeScript.',
      'APIs REST con Node.js y Express; modelado de datos con PostgreSQL, MongoDB y Prisma.',
      'Integración de APIs de LLMs (OpenAI) en productos para asistentes conversacionales y automatización de procesos.',
      'Flujo de trabajo asistido por IA (Claude Code, Copilot CLI, conectores MCP) con un plan de trabajo por feature y skills reutilizables.',
      'Comunicación directa con clientes: estimaciones, entregas iterativas y soporte.',
      'Proyecto destacado: sistema para una consultora de RRHH, para la administración de búsquedas, candidatos y ruta de procesos.',
    ],
    published: true,
    technologies: [
      'React',
      'Next.js',
      'TypeScript',
      'Node.js',
      'Express.js',
      'PostgreSQL',
      'MongoDB',
      'Prisma',
      'Claude Code',
      'Conectores MCP',
    ],
  },
  {
    order: 3,
    role: 'Desarrollador Full Stack',
    company: 'Mindfactory',
    client: null,
    clientPublic: true,
    startDate: month('2024-07'),
    endDate: month('2025-09'),
    location: 'Córdoba, Argentina',
    modality: 'HYBRID',
    description: 'Los primeros 6 meses enfocado en backend, luego también en frontend.',
    highlights: [
      'Backend: desarrollo y optimización de APIs con Node.js y TypeScript; aporte en decisiones de arquitectura escalable.',
      'Frontend: interfaces con React, Next.js y Vue (JavaScript/TypeScript), implementadas a partir de diseños en Figma.',
      'Tests unitarios con Jest.',
    ],
    published: true,
    technologies: [
      'React',
      'Next.js',
      'Vue.js',
      'JavaScript',
      'TypeScript',
      'Node.js',
      'Express.js',
      'MongoDB',
      'Jest',
      'Figma',
    ],
  },
  {
    order: 4,
    role: 'Desarrollador Full Stack',
    company: 'Rankerfy',
    client: null,
    clientPublic: true,
    startDate: month('2023-11'),
    endDate: month('2024-07'),
    location: 'España',
    modality: 'REMOTE',
    description:
      'Desarrollo y evolución de la aplicación web, con foco en interfaces dinámicas, accesibles y escalables, y en APIs y servicios backend.',
    highlights: [
      'Frontend: componentes reutilizables con React y TypeScript, documentados con Storybook.',
      'Backend: APIs y servicios con Node.js, Express y TypeScript.',
      'Tests unitarios con Jest en frontend y backend.',
      'Trabajo en equipo ágil con seguimiento de sprints en Jira.',
    ],
    published: true,
    technologies: [
      'React',
      'TypeScript',
      'Node.js',
      'Express.js',
      'MongoDB',
      'Storybook',
      'Jest',
      'Jira',
    ],
  },
  {
    order: 5,
    role: 'Desarrollador Frontend',
    company: 'Softnik',
    client: null,
    clientPublic: true,
    startDate: month('2023-01'),
    endDate: month('2023-11'),
    location: 'Córdoba, Argentina',
    modality: 'REMOTE',
    description:
      'Sistema personalizado de gestión de horarios para empleados: registro de personal, definición de días/horarios y validación de asistencia por geolocalización (GPS) al ingreso y egreso.',
    highlights: [
      'Interfaces intuitivas y responsivas con React, JavaScript y SCSS.',
      'Pruebas automatizadas con Jest y React Testing Library.',
      'Entorno ágil (Scrum) con Jira y GitLab.',
    ],
    published: true,
    technologies: [
      'React',
      'JavaScript',
      'SCSS',
      'Jest',
      'React Testing Library',
      'GitLab',
      'Jira',
      'Scrum/Ágil',
    ],
  },
];

// No technologies linked to education: the owner loads them later.
const education: Prisma.EducationCreateManyInput[] = [
  {
    order: 1,
    type: 'DEGREE',
    title: 'Programador (Técnico en Programación)',
    institution: 'Universidad Tecnológica Nacional, Facultad Regional Córdoba',
    // Only the years are known: January is provisional (docs/ROADMAP.md, pending).
    startedAt: month('2017-01'),
    completedAt: month('2019-01'),
    published: true,
  },
  {
    order: 2,
    type: 'CERTIFICATION',
    title: 'Curso de Diseño UX/UI',
    institution: 'UTN Buenos Aires',
    completedAt: month('2025-10'),
    published: true,
  },
  {
    order: 3,
    type: 'CERTIFICATION',
    title: 'Desarrollador Full Stack',
    institution: 'Coderhouse',
    completedAt: month('2022-09'),
    published: true,
  },
  {
    order: 4,
    type: 'CERTIFICATION',
    title: 'Desarrollador React Native',
    institution: 'Coderhouse',
    completedAt: month('2022-06'),
    published: true,
  },
  {
    order: 5,
    type: 'CERTIFICATION',
    title: 'Desarrollador Front End',
    institution: 'Coderhouse',
    completedAt: month('2021-09'),
    published: true,
  },
  {
    order: 6,
    type: 'COURSE',
    title: 'JavaScript de Cero a Experto',
    institution: 'Udemy',
    completedAt: month('2021-06'),
    published: true,
  },
];

async function main(databaseUrl: string) {
  const prisma = createPrismaClient(databaseUrl);
  try {
    const existing = await prisma.profile.findUnique({ where: { id: 1 } });
    if (existing && !force) {
      console.log('Profile already exists: seed skipped. Use SEED_FORCE=true to reload the CV.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (existing) {
        // Only the CV tables. The join tables go with Experience/Education/Technology (cascade).
        await tx.experience.deleteMany();
        await tx.education.deleteMany();
        await tx.technology.deleteMany();
        await tx.language.deleteMany();
        await tx.profile.deleteMany();
      }

      await tx.profile.create({ data: profile });
      await tx.language.createMany({ data: languages });
      await tx.technology.createMany({ data: technologies });
      for (const { technologies: names, ...experience } of experiences) {
        await tx.experience.create({
          data: { ...experience, technologies: { connect: names.map((name) => ({ name })) } },
        });
      }
      await tx.education.createMany({ data: education });
    });

    console.log(
      `Seed done: profile, ${String(languages.length)} languages, ${String(technologies.length)} technologies, ` +
        `${String(experiences.length)} experiences, ${String(education.length)} education entries.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main(url);
