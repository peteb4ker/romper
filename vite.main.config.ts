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
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "electron/main/index.ts"),
      fileName: "index",
      formats: ["es"],
      name: "main",
    },
    minify: false,
    outDir: "dist/electron/main",
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
      output: {
        entryFileNames: "[name].js",
      },
      preserveEntrySignatures: "strict",
    },
    sourcemap: true,
    target: "node18",
  },
  plugins: [copyMigrations()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@romper/shared": resolve(__dirname, "shared"),
      "node:buffer": "buffer",
      "node:child_process": "child_process",
      "node:crypto": "crypto",
      "node:events": "events",
      "node:fs": "fs",
      "node:http": "http",
      "node:https": "https",
      "node:net": "net",
      "node:os": "os",
      "node:path": "path",
      "node:querystring": "querystring",
      "node:stream": "stream",
      "node:tls": "tls",
      "node:url": "url",
      "node:util": "util",
      "node:zlib": "zlib",
    },
  },
});
