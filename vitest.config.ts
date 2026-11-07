import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    // No modules yet: an empty suite is valid. Remove once the first module ships with tests,
    // so a broken include glob fails loudly instead of passing silently.
    passWithNoTests: true,

    globals: false, // explicit imports from 'vitest': no ambient globals to type
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 10_000,
    // Shared test database: files truncate tables between tests, so they can't run in parallel.
    fileParallelism: false,

    coverage: {
      provider: 'v8',
      include: ['src/modules/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/*.types.ts', 'src/**/index.ts'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Only meaningful for the full suite (yarn test:coverage); a single-file run will fail them.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
