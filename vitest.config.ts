import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
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
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/**/*.types.ts',
        'src/**/index.ts',
        // TEMPORARY: still notImplemented, it needs the CV modules' types (fase 3).
        'src/modules/chat/prompt/profile-context.ts',
      ],
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
