import { defineConfig } from "vite";
import baseConfig from '../vite.base.config';
import { fileURLToPath, URL } from 'url';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  ...baseConfig,
  resolve: {
    ...(baseConfig.resolve || {}),
    alias: [
      ...(baseConfig.resolve?.alias || []),
      {
        find: "@romper/shared",
        replacement: fileURLToPath(new URL("../shared", import.meta.url)),
      },
    ],
  },
  plugins: [
    ...baseConfig.plugins,
    tailwindcss(),
  ],
  test: {
    ...baseConfig.test,
    include: [
      "renderer/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "shared/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
    ],
    watch: false,
    run: true,
    coverage: {
      enabled: true,
      reporter: ["json", "html"],
      reportsDirectory: "./coverage",
      include: ["renderer/**/*.ts", "renderer/**/*.tsx", "shared/**/*.ts"],
      exclude: ["renderer/**/*.d.ts", "renderer/styles/**"],
      reportOnFailure: true,
    },
  }
});
