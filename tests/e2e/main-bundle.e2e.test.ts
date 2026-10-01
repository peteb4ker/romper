import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

/**
 * The built main process is Node code (RE-16). Built as a browser library,
 * it got empty stubs for Node built-ins and a require() shim that throws in
 * an ES module, so update-electron-app never ran in a packaged build. The
 * e2e run builds the app first, so this checks the real output.
 */
const MAIN_DIR = path.resolve("dist/electron/main");
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve("package.json"), "utf8"),
) as { dependencies: Record<string, string> };

function mainBundleFiles(): string[] {
  return fs
    .readdirSync(MAIN_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(MAIN_DIR, name));
}

/** "drizzle-orm/sqlite-core" -> "drizzle-orm"; "@scope/pkg/x" -> "@scope/pkg" */
function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

test.describe("Built main process", () => {
  test("has no browser stubs or require() shims", () => {
    for (const file of mainBundleFiles()) {
      const code = fs.readFileSync(file, "utf8");
      expect(code, path.basename(file)).not.toContain("browser-external");
      expect(code, path.basename(file)).not.toContain(
        "in an environment that doesn't expose the `require` function",
      );
    }
  });

  test("imports only Node built-ins, electron and runtime dependencies", () => {
    const runtimeDependencies = new Set(Object.keys(packageJson.dependencies));
    const specifiers = new Set<string>();
    for (const file of mainBundleFiles()) {
      const code = fs.readFileSync(file, "utf8");
      for (const match of code.matchAll(
        /(?:\bfrom\s*|\bimport\s*\(\s*|^import\s+)["']([^"'./][^"']*)["']/gm,
      )) {
        specifiers.add(match[1]);
      }
    }

    const missing = [...specifiers].filter((specifier) => {
      if (specifier === "electron" || specifier.startsWith("node:")) {
        return false;
      }
      if (builtinModules.includes(specifier)) return false;
      return !runtimeDependencies.has(packageName(specifier));
    });

    // A package main imports must ship in the packaged app's node_modules
    expect(missing).toEqual([]);
    expect(specifiers).toContain("update-electron-app");
  });
});
