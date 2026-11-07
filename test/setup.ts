import { existsSync } from 'node:fs';

// Test env comes from .env.test (gitignored). loadEnvFile does not override variables
// already set in the shell, so the guard below also covers a DATABASE_URL exported by hand.
if (existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

// Tests truncate tables between runs: refuse to touch anything that isn't a test database.
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to run tests against database "${databaseName}": DATABASE_URL must point to a test database (name containing "test").`,
    );
  }
}
