import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve } from "path";
import { dirname, join } from "path";
import { defineConfig } from "vite";

// Plugin to copy migrations directory
function copyMigrations() {
  return {
    name: "copy-migrations",
    writeBundle() {
      const src = resolve(__dirname, "electron/main/db/migrations");
      const dest = resolve(__dirname, "dist/electron/main/db/migrations");

      function copyDir(srcDir: string, destDir: string) {
        mkdirSync(destDir, { recursive: true });
        const items = readdirSync(srcDir);

        for (const item of items) {
          const srcPath = join(srcDir, item);
          const destPath = join(destDir, item);

          if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            mkdirSync(dirname(destPath), { recursive: true });
            copyFileSync(srcPath, destPath);
          }
        }
      }

      copyDir(src, dest);
    },
  };
}

export default defineConfig({
  plugins: [copyMigrations()],
  build: {
    lib: {
      entry: resolve(__dirname, "electron/main/index.ts"),
      name: "main",
      fileName: "index",
      formats: ["es"],
    },
    outDir: "dist/electron/main",
    emptyOutDir: true,
    rollupOptions: {
      external: [
        "electron",
        "better-sqlite3",
        "fs",
        "path",
        "os",
        "crypto",
        "stream",
        "util",
        "events",
        "buffer",
        "url",
        "querystring",
        "child_process",
        "net",
        "tls",
        "http",
        "https",
        "zlib",
        "unzipper",
        "play-sound",
      ],
      preserveEntrySignatures: "strict",
      output: {
        entryFileNames: "[name].js",
      },
    },
    target: "node18",
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "node:crypto": "crypto",
      "node:fs": "fs",
      "node:path": "path",
      "node:os": "os",
      "node:util": "util",
      "node:stream": "stream",
      "node:buffer": "buffer",
      "node:url": "url",
      "node:events": "events",
      "node:querystring": "querystring",
      "node:child_process": "child_process",
      "node:net": "net",
      "node:tls": "tls",
      "node:http": "http",
      "node:https": "https",
      "node:zlib": "zlib",
    },
  },
});
