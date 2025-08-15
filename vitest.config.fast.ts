import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import path from "path";
import { defineConfig } from "vite";

// Fast test configuration without coverage for local development
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
    return {
      // COVERAGE DISABLED FOR FAST MODE
      coverage: {
        enabled: false,
      },
      environment: isIntegration ? "node" : "jsdom",
      exclude: [
        "node_modules",
        "dist",
        "out",
        "**/*.e2e.test.{js,ts,jsx,tsx}",
        ...(isIntegration ? [] : ["**/*.integration.test.{js,ts,jsx,tsx}"]),
      ],
      // Faster test execution
      hookTimeout: 10000,
      include: isIntegration
        ? ["**/*.integration.test.{js,ts,jsx,tsx}"]
        : ["**/*.test.{js,ts,jsx,tsx}"],
      // Maximum parallelization for 12-core machine
      pool: "threads",
      poolOptions: {
        threads: {
          // Use more threads for faster execution
          maxThreads: 10,
          minThreads: 4,
          // Enable atomics for better thread synchronization
          useAtomics: true,
        },
      },
      // Optimized reporters - dot is fastest
      reporter: ["dot"],
      setupFiles: ["./vitest.setup.ts"],
      testTimeout: 15000,
    };
  })(),
  worker: {
    format: "es",
  },
});
