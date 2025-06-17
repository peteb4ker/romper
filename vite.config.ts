import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Centralized Vite config for all packages (renderer, shared, etc)
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    // Add more plugins here as needed
  ],
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
  test: {
    include: [
      "app/renderer/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "shared/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "electron/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}"
    ],
    exclude: [
      "node_modules",
      "dist",
      "out",
      "electron/main/db/__tests__/integration/**"
    ],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      enabled: true,
      reporter: ["json", "html"],
      reportsDirectory: "./coverage",
      include: [
        "app/renderer/**/*.ts",
        "app/renderer/**/*.tsx",
        "shared/**/*.ts",
        "electron/**/*.ts"
      ],
      exclude: [
        "**/*.d.ts",
        "app/renderer/styles/**"
      ],
      reportOnFailure: true,
      provider: "v8",
    },
  },
});
