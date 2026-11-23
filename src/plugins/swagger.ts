import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export const ADMIN_SECURITY_SCHEME = 'adminKey';

async function swaggerDocs(app: FastifyInstance) {
  // Must be registered before the routes so it sees them (onRoute hook).
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'portfolio-back',
        description:
          'API del portfolio de Lisandro Córdoba: CV editable y chat con IA. Las rutas `/admin/*` y las mutaciones requieren `x-admin-key`.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          [ADMIN_SECURITY_SCHEME]: { type: 'apiKey', in: 'header', name: 'x-admin-key' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    // Serves swagger-ui with its own CSP, so helmet's strict default stays for the API.
    staticCSP: true,
  });
}

export default fp(swaggerDocs, { name: 'swagger', fastify: '5.x' });
