import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import path from "node:path";
import { defineConfig } from "vite";

import { testWorkerCount } from "./vitest.workers";

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
        // Anchored so a checkout inside a worktrees/ dir still watches itself.
        path.resolve(__dirname, "worktrees") + "/**",
        path.resolve(__dirname, ".claude/worktrees") + "/**",
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
      // Bundle the icon library into one file (#597). Its entry re-exports
      // thousands of per-icon modules, and each test file that rendered an
      // icon opened them all at once. The thread workers share one process,
      // so on a busy machine that process briefly held more than 10240 file
      // descriptors, and macOS can't spawn a child whose pipes land above
      // OPEN_MAX (10240): spawnSync in guardGitHook.test.ts failed with
      // EBADF.
      deps: {
        optimizer: {
          client: { enabled: true, include: ["@phosphor-icons/react"] },
        },
      },
      environment: isIntegration ? "node" : "jsdom",
      exclude: [
        "node_modules",
        "dist",
        "out",
        "worktrees",
        "**/.claude/worktrees/**",
        "**/*.e2e.test.{js,ts,jsx,tsx}",
        ...(isIntegration ? [] : ["**/*.integration.test.{js,ts,jsx,tsx}"]),
      ],
      // Faster test execution
      hookTimeout: 10000,
      include: isIntegration
        ? ["**/*.integration.test.{js,ts,jsx,tsx}"]
        : ["**/*.test.{js,ts,jsx,tsx}"],
      // Sized to the free cores, so a busy machine doesn't time workers out
      maxWorkers: testWorkerCount(),
      minWorkers: 1,
      pool: "threads",
      // Optimized reporters - dot is fastest
      reporter: ["dot"],
      // Integration tests close every database connection when a test's
      // body ends, before its afterEach hooks delete temp stores (Windows
      // can't delete an open database file). See tests/integration/support.
      runner: isIntegration
        ? "./tests/integration/support/runner.ts"
        : undefined,
      setupFiles: isIntegration
        ? ["./vitest.setup.ts", "./tests/integration/support/setup.ts"]
        : ["./vitest.setup.ts"],
      testTimeout: 15000,
    };
  })(),
  worker: {
    format: "es",
  },
});
