// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { appFolder, checkAppFolder, smokeEnv } from "../smoke-packaged-app.mjs";

// #626: the packaged-app smoke test launched the app without its own
// settings folder, so a local run wrote the installed app's settings.
describe("[Q-07] packaged-app smoke test environment", () => {
  const root = path.join("tmp", "romper-smoke-abc");

  it("gives the app its own settings folder inside the run's temp folder", () => {
    const env = smokeEnv({}, root);

    expect(env.ROMPER_USER_DATA_DIR).toBe(path.join(root, "user-data"));
    expect(env.ROMPER_HEADLESS).toBe("true");
    expect(env.ROMPER_LOCAL_PATH).toBe(path.join(root, "store"));
    expect(env.ROMPER_SDCARD_PATH).toBe(path.join(root, "card"));
  });

  it("replaces a settings folder or headless flag inherited from the caller", () => {
    const env = smokeEnv(
      {
        PATH: "/usr/bin",
        ROMPER_HEADLESS: "false",
        ROMPER_USER_DATA_DIR: "/installed/app/settings",
      },
      root,
    );

    expect(env.ROMPER_USER_DATA_DIR).toBe(path.join(root, "user-data"));
    expect(env.ROMPER_HEADLESS).toBe("true");
    expect(env.PATH).toBe("/usr/bin");
  });

  it("keeps everything the app writes under the run's temp folder", () => {
    const env = smokeEnv({}, root);

    for (const key of [
      "ROMPER_LOCAL_PATH",
      "ROMPER_SDCARD_PATH",
      "ROMPER_USER_DATA_DIR",
    ] as const) {
      expect(path.relative(root, env[key]!)).not.toMatch(/^\.\./);
    }
  });
});

// #464: the smoke test checks the packaged app folder holds what the app
// loads and nothing the packaging allowlist leaves out
describe("[Q-05] packaged-app smoke test app folder check", () => {
  const REQUIRED = [
    "package.json",
    "dist/electron/main/index.js",
    "dist/electron/main/db/migrations/meta/_journal.json",
    "dist/electron/preload/index.cjs",
    "dist/renderer/index.html",
    "node_modules/better-sqlite3/package.json",
    "node_modules/drizzle-orm/package.json",
  ];
  let appDir: string | undefined;

  function makeAppFolder(files: string[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-app-folder-"));
    appDir = dir;
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), "");
    }
    return dir;
  }

  afterEach(() => {
    if (appDir) fs.rmSync(appDir, { force: true, recursive: true });
    appDir = undefined;
  });

  it("finds resources/app from the executable on each platform", () => {
    const mac = path.join("out", "Romper.app", "Contents", "MacOS", "romper");
    expect(appFolder(mac)).toBe(
      path.resolve("out", "Romper.app", "Contents", "Resources", "app"),
    );
    const linux = path.join("out", "Romper-linux-x64", "romper");
    expect(appFolder(linux)).toBe(
      path.resolve("out", "Romper-linux-x64", "resources", "app"),
    );
  });

  it("passes a folder with the build output, package.json and node_modules", () => {
    expect(checkAppFolder(makeAppFolder([...REQUIRED, "LICENSE"]))).toEqual([]);
  });

  it("reports repo files that shouldn't ship", () => {
    const dir = makeAppFolder([...REQUIRED, ".env.local", "BACKLOG.md"]);
    fs.mkdirSync(path.join(dir, "aidlc-docs"));

    expect(checkAppFolder(dir)).toEqual([
      "unexpected .env.local",
      "unexpected BACKLOG.md",
      "unexpected aidlc-docs",
    ]);
  });

  it("reports a missing migrations folder or native module", () => {
    const dir = makeAppFolder(
      REQUIRED.filter(
        (file) => !file.includes("migrations") && !file.includes("sqlite"),
      ),
    );

    expect(checkAppFolder(dir)).toEqual([
      "missing dist/electron/main/db/migrations/meta/_journal.json",
      "missing node_modules/better-sqlite3/package.json",
    ]);
  });
});
