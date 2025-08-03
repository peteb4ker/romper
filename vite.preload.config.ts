import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "electron/preload/index.ts"),
      fileName: "index",
      formats: ["es"],
      name: "preload",
    },
    minify: false,
    outDir: "dist/electron/preload",
    rollupOptions: {
      external: ["electron"],
      output: {
        entryFileNames: "[name].mjs",
      },
    },
    sourcemap: true,
    target: "node18",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
