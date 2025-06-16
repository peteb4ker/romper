import { defineConfig } from "vite";
import baseConfig from '../vite.base.config';
import path from "path";

export default defineConfig({
  ...baseConfig,
  resolve: {
    ...(baseConfig.resolve || {}),
    alias: [
      ...(baseConfig.resolve?.alias || []),
      {
        find: "@romper/shared",
        replacement: path.resolve(__dirname, "../shared"),
      },
      {
        find: "@romper/shared/kitUtilsShared",
        replacement: path.resolve(__dirname, "../shared/dist/kitUtilsShared.js"),
      },
    ],
  },
  test: {
    ...baseConfig.test,
    include: [
      "main/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "preload/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "../shared/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
    ],
    watch: false,
    coverage: {
      enabled: true,
      reporter: ["json", "html"],
      reportsDirectory: "./coverage",
      include: ["main/**/*.ts", "preload/**/*.ts", "../shared/**/*.ts"],
      exclude: ["**/*.d.ts"],
      reportOnFailure: true,
    },
  }
});
