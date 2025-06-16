import baseConfig from '../vite.base.config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      ...(baseConfig.test?.coverage ?? {}),
      ...(baseConfig.test?.coverage?.provider !== 'custom' ? { include: ['**/*.ts'], provider: 'v8' } : {}),
    },
  },
});
