import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['../vitest.setup.ts'],
    include: ['__tests__/**/*.test.ts'],
    watch: false,
    coverage: {
      enabled: true,
      reporter: ['json', 'html'],
      reportsDirectory: './coverage',
      include: ['**/*.ts'],
      exclude: ['**/*.d.ts'],
      reportOnFailure: true,
      provider: 'v8',
    },
  },
});
