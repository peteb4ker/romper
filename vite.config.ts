import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import { defineConfig } from "vite";

// Centralized Vite config for all packages (renderer, shared, etc)
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  root: ".",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
  },
  css: {
    postcss: {
      plugins: [autoprefixer()],
    },
  },
  test: (() => {
    const isIntegration = process.env.VITEST_MODE === "integration";
    return {
      include: isIntegration
        ? ["**/*.integration.test.{js,ts,jsx,tsx}"]
        : ["**/*.test.{js,ts,jsx,tsx}"],
      exclude: [
        "node_modules",
        "dist",
        "out",
        "**/*.e2e.test.{js,ts,jsx,tsx}",
        ...(isIntegration ? [] : ["**/*.integration.test.{js,ts,jsx,tsx}"]),
      ],
      environment: isIntegration ? "node" : "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      coverage: {
        enabled: true,
        reporter: ["json", "html"],
        reportsDirectory: "./coverage",
        include: [
          "app/renderer/**/*.ts",
          "app/renderer/**/*.tsx",
          "shared/**/*.ts",
          "electron/**/*.ts",
        ],
        exclude: ["**/*.d.ts", "app/renderer/styles/**"],
        reportOnFailure: true,
        provider: "v8",
      },
    };
  })(),
});
