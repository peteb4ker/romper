import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

// Tightens the Content-Security-Policy in the *production* index.html while
// leaving the dev CSP (which must allow the Vite HMR websocket) untouched.
// The dev `connect-src ws://localhost:*` is removed from packaged builds and
// `base-uri` / `frame-ancestors` / `object-src` are added.
function hardenProductionCsp(): Plugin {
  const productionCsp = [
    "default-src 'self'",
    "script-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ");

  return {
    name: "romper-harden-production-csp",
    transformIndexHtml: {
      handler(html, ctx) {
        // ctx.server is only defined during `vite` dev serve; in `vite build`
        // it is undefined, which is exactly when we want the hardened CSP.
        if (ctx.server) {
          return html;
        }
        return html.replace(
          /<meta\s+http-equiv="Content-Security-Policy"[^>]*\/?>/i,
          `<meta http-equiv="Content-Security-Policy" content="${productionCsp}" />`,
        );
      },
      order: "post",
    },
  };
}

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
  plugins: [react(), tailwindcss(), hardenProductionCsp()],
  resolve: {
    alias: {
      "@romper/app": path.resolve(__dirname, "app"),
      "@romper/electron": path.resolve(__dirname, "electron"),
      "@romper/shared": path.resolve(__dirname, "shared"),
    },
  },
  root: ".",
  server: {
    strictPort: true,
    watch: {
      ignored: [
        "**/coverage/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/out/**",
        // Only ignore the local worktrees/ subdirectory, not ancestor worktree paths
        path.resolve(__dirname, "worktrees") + "/**",
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
        // Only enforce thresholds for unit tests; integration tests cover
        // a small subset of files and will naturally have lower percentages.
        // Re-baselined for Vitest 4's rewritten v8 coverage (AST-aware
        // remapping counts branches/statements differently than Vitest 3 —
        // the old 85/85 gate went permanently red the day the migration
        // landed). Set just below current main (84.75 st / 77.99 br /
        // 82.36 fn / 85.47 ln) so the gate catches regressions; ratchet
        // these up as coverage grows.
        thresholds: isIntegration
          ? undefined
          : {
              branches: 77,
              functions: 82,
              lines: 85,
              statements: 84,
            },
      },
      environment: isIntegration ? "node" : "jsdom",
      exclude: [
        "node_modules",
        "dist",
        "out",
        "worktrees",
        "**/*.e2e.test.{js,ts,jsx,tsx}",
        ...(isIntegration ? [] : ["**/*.integration.test.{js,ts,jsx,tsx}"]),
      ],
      // Faster test execution in CI
      hookTimeout: isCI ? 10000 : 15000,
      include: isIntegration
        ? ["**/*.integration.test.{js,ts,jsx,tsx}"]
        : ["**/*.test.{js,ts,jsx,tsx}"],
      // Performance optimizations
      maxWorkers: isCI ? 8 : 2,
      minWorkers: isCI ? 2 : 1,
      pool: "threads",
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
