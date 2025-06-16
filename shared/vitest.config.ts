import baseConfig from '../vite.base.config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      ...baseConfig.test.coverage,
      include: ['**/*.ts'],
    },
  },
});
