import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Browser-based crawler tests are heavy; run files one at a time.
    fileParallelism: false,
  },
});