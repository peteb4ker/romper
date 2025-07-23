import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "electron/preload/index.ts"),
      name: "preload",
      fileName: "index",
      formats: ["es"],
    },
    outDir: "dist/electron/preload",
    emptyOutDir: false,
    rollupOptions: {
      external: [
        "electron",
      ],
      output: {
        entryFileNames: "[name].mjs",
      },
    },
    target: "node18",
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
