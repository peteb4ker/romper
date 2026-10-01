import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { dirname, join } from "node:path";
import { defineConfig } from "vite";

import packageJson from "./package.json" with { type: "json" };

// The main process runs on Node, not in a browser (RE-16). Node built-ins
// and the app's runtime dependencies are left as imports and loaded from
// Node and the packaged node_modules at runtime. Bundling them for a
// browser target replaced built-ins such as node:assert and
// node:timers/promises with empty stubs, and bundled CommonJS packages
// called a require() that doesn't exist in an ES module, which is why
// update-electron-app never ran in a packaged build.
const runtimeDependencies = Object.keys(packageJson.dependencies);

// Plugin to copy a directory from source to dist
function copyDirectory(srcRelative: string, destRelative: string) {
  return {
    name: `copy-${srcRelative.replace(/\//g, "-")}`,
    writeBundle() {
      const src = resolve(__dirname, srcRelative);
      const dest = resolve(__dirname, destRelative);

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

function isExternal(id: string): boolean {
  if (id === "electron" || id.startsWith("node:")) return true;
  if (builtinModules.includes(id)) return true;
  return runtimeDependencies.some(
    (dependency) => id === dependency || id.startsWith(`${dependency}/`),
  );
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
      external: isExternal,
      output: {
        entryFileNames: "[name].js",
      },
      preserveEntrySignatures: "strict",
    },
    sourcemap: true,
    target: "node18",
  },
  plugins: [
    copyDirectory(
      "electron/main/db/migrations",
      "dist/electron/main/db/migrations",
    ),
    copyDirectory("electron/main/resources", "dist/electron/main/resources"),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@romper/shared": resolve(__dirname, "shared"),
    },
  },
});
