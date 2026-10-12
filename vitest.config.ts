import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    // Several suites spawn built CLI processes; bound parallel workers to keep E2E fixtures isolated.
    maxWorkers: 4,
  },
});
