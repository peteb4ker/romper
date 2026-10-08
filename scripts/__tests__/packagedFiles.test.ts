// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { ignorePackagedPath, SHIPPED_ENTRIES } =
  require("../packaged-files.cjs") as typeof import("../packaged-files.cjs");

// #464: packaging listed what to leave out, so repo files nobody listed
// (aidlc-docs/, BACKLOG.md, a local .env.local, TypeScript sources) shipped
// in the installed app. It now lists what to keep.
describe("[Q-05] packaged app folder allowlist", () => {
  it.each([
    "",
    "/package.json",
    "/LICENSE",
    "/dist",
    "/dist/electron",
    "/dist/electron/main",
    "/dist/electron/main/index.js",
    "/dist/electron/main/db/migrations/0000_stiff_martin_li.sql",
    "/dist/electron/main/db/migrations/meta/_journal.json",
    "/dist/electron/main/resources/gearSixTemplate.png",
    "/dist/electron/preload/index.cjs",
    "/dist/renderer/index.html",
    "/dist/renderer/assets/index.js",
    "/node_modules",
    "/node_modules/better-sqlite3/lib/binding.js",
    "/node_modules/better-sqlite3/prebuilds/darwin-arm64.node",
    "/node_modules/drizzle-orm/package.json",
    "/node_modules/drizzle-orm/sqlite-core/index.js",
    "/node_modules/@scope/package/lib/index.d.ts",
  ])("ships %s", (file) => {
    expect(ignorePackagedPath(file)).toBe(false);
  });

  it.each([
    "/.env.local",
    "/.claude",
    "/.claude/settings.local.json",
    "/.git",
    "/aidlc-docs",
    "/aidlc-docs/inception/reverse-engineering/code-quality-assessment.md",
    "/BACKLOG.md",
    "/CLAUDE.md",
    "/app/renderer/main.tsx",
    "/electron/main/index.ts",
    "/electron/resources/app-icon.icns",
    "/shared/db/schema.ts",
    "/dist/shared/db/schema.js",
    "/drizzle.config.ts",
    "/forge.config.cjs",
    "/package-lock.json",
    "/scripts/smoke-packaged-app.mjs",
    "/out/Romper-darwin-arm64",
    "/some-new-file-nobody-listed.md",
  ])("leaves out %s", (file) => {
    expect(ignorePackagedPath(file)).toBe(true);
  });

  it.each([
    "/node_modules/.bin",
    "/node_modules/.bin/drizzle-kit",
    "/node_modules/.package-lock.json",
    "/node_modules/.vite/vitest/results.json",
    "/node_modules/update-electron-app/.yarn/releases/yarn.cjs",
    "/node_modules/is-url/.travis.yml",
    "/node_modules/better-sqlite3/build/Release/obj.target/sqlite3.o",
    "/node_modules/better-sqlite3/binding.gyp",
    "/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c",
    "/node_modules/better-sqlite3/src/better_sqlite3.cpp",
    "/node_modules/some-module/node_gyp_bins/python3",
  ])("leaves %s out of node_modules", (file) => {
    expect(ignorePackagedPath(file)).toBe(true);
  });

  it("names every top-level entry it ships", () => {
    expect([...SHIPPED_ENTRIES].sort()).toEqual([
      "LICENSE",
      "dist",
      "node_modules",
      "package.json",
    ]);
    for (const entry of SHIPPED_ENTRIES) {
      expect(ignorePackagedPath(`/${entry}`)).toBe(false);
    }
  });
});
