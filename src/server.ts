import { existsSync } from 'node:fs';
import { buildApp } from './app.js';

// Local dev reads .env; in production the hosting injects the variables and there's no file.
// loadEnvFile never overrides variables already set in the shell.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  const app = await buildApp();

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');

    // If something hangs on close (an open connection, a stuck query), don't wait forever.
    const timer = setTimeout(() => {
      app.log.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    // close() stops accepting connections, waits for in-flight requests and runs onClose hooks.
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, 'error during shutdown');
        process.exit(1);
      },
    );
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await app.listen({ host: app.config.HOST, port: app.config.PORT });
}

start().catch((error: unknown) => {
  // The logger may not exist yet (e.g. invalid env), so this one goes to stderr directly.
  console.error(error);
  process.exit(1);
});
