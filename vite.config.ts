import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import path from "path";
import { defineConfig } from "vite";

// Centralized Vite config for all packages (renderer, shared, etc)
export default defineConfig({
  base: "./",
  build: {
    emptyOutDir: true,
    outDir: "dist/renderer",
  },
  css: {
    postcss: {
      plugins: [autoprefixer()],
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@romper/app": path.resolve(__dirname, "app"),
      "@romper/electron": path.resolve(__dirname, "electron"),
      "@romper/shared": path.resolve(__dirname, "shared"),
    },
  },
  root: ".",
  server: {
    watch: {
      ignored: [
        "**/coverage/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/out/**",
      ],
    },
  },
  test: (() => {
    const isIntegration = process.env.VITEST_MODE === "integration";
    const isCI = process.env.CI === "true";
    return {
      coverage: {
        all: !isIntegration, // true for unit tests, false for integration
        enabled: true,
        exclude: [
          "**/*.d.ts",
          "app/renderer/styles/**",
          "**/__tests__/**",
          "**/test-utils/**",
          "**/*.test.*",
          "**/*Mock*.tsx",
          "**/*Mock*.ts",
        ],
        include: [
          "app/renderer/**/*.ts",
          "app/renderer/**/*.tsx",
          "shared/**/*.ts",
          "electron/**/*.ts",
        ],
        provider: "v8",
        reporter: ["json", "html", "text-summary", "lcov"],
        reportOnFailure: true,
        reportsDirectory: isIntegration
          ? "./coverage/integration"
          : "./coverage/unit",
      },
      environment: isIntegration ? "node" : "jsdom",
      exclude: [
        "node_modules",
        "dist",
        "out",
        "**/*.e2e.test.{js,ts,jsx,tsx}",
        ...(isIntegration ? [] : ["**/*.integration.test.{js,ts,jsx,tsx}"]),
      ],
      // Faster test execution in CI
      hookTimeout: isCI ? 10000 : 15000,
      include: isIntegration
        ? ["**/*.integration.test.{js,ts,jsx,tsx}"]
        : ["**/*.test.{js,ts,jsx,tsx}"],
      // Performance optimizations
      pool: "threads",
      poolOptions: {
        threads: {
          // Use more threads in CI for faster execution
          maxThreads: isCI ? 4 : 2,
          minThreads: isCI ? 2 : 1,
        },
      },
      // Optimized reporters for CI
      reporter: isCI ? ["dot"] : ["verbose"],
      setupFiles: ["./vitest.setup.ts"],
      testTimeout: isCI ? 15000 : 30000,
    };
  })(),
  worker: {
    format: "es",
  },
});
