import { execFileSync } from 'node:child_process';
// Same guard as the test workers: loads .env.test and refuses a non-test database.
import './setup.js';
import { TEST_DATABASE_URL } from './helpers/database.js';

/**
 * Runs once before the whole suite: applies the migrations to the test database.
 * DIRECT_DATABASE_URL is set explicitly, so prisma.config.ts never falls back to the .env one.
 * The CLI runs straight through node: `npx` inside `yarn test` resolves the wrong path on Windows.
 */
export default function globalSetup() {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'pipe',
    env: { ...process.env, DIRECT_DATABASE_URL: TEST_DATABASE_URL },
  });
}
