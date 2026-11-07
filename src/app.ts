import Fastify from 'fastify';

const app = Fastify({
  logger: true,
});

app.get('/', async () => {
  return {
    message: 'API funcionando correctamente',
  };
});

app.get('/health', async () => {
  return {
    status: 'ok',
  };
});

export default app;