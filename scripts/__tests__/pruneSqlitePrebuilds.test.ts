// @vitest-environment node
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { PREBUILDS_DIR, pruneSqlitePrebuilds } =
  require("../prune-sqlite-prebuilds.cjs") as {
    PREBUILDS_DIR: string;
    pruneSqlitePrebuilds: (
      buildPath: string,
      platform: string,
      arch: string,
    ) => string[];
  };

// What better-sqlite3 13's npm package ships in prebuilds/
const ALL_PREBUILDS = [
  "darwin-arm64.node",
  "darwin-x64.node",
  "linux-arm64.node",
  "linux-x64.node",
  "linuxmusl-arm64.node",
  "linuxmusl-x64.node",
  "win32-arm64.node",
  "win32-x64.node",
];

/** A packaged app's folder holding every prebuild better-sqlite3 ships */
function makeBuild() {
  const buildPath = fs.mkdtempSync(path.join(os.tmpdir(), "romper-prebuilds-"));
  const dir = path.join(buildPath, PREBUILDS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of ALL_PREBUILDS) {
    fs.writeFileSync(path.join(dir, file), file);
  }
  return { buildPath, dir };
}

// #694: the Linux x64 package shipped better-sqlite3's arm64 prebuilds, and
// the rpm maker's strip couldn't read them, so the release build failed.
describe("[Q-05] packaged better-sqlite3 prebuilds", () => {
  let buildPath: string;
  let dir: string;

  beforeEach(() => {
    ({ buildPath, dir } = makeBuild());
  });

  afterEach(() => {
    fs.rmSync(buildPath, { force: true, recursive: true });
  });

  it.each([
    ["linux", "x64"],
    ["darwin", "arm64"],
    ["win32", "x64"],
  ])("keeps only the %s-%s binary", (platform, arch) => {
    const removed = pruneSqlitePrebuilds(buildPath, platform, arch);

    expect(fs.readdirSync(dir)).toEqual([`${platform}-${arch}.node`]);
    expect(removed).toHaveLength(ALL_PREBUILDS.length - 1);
  });

  it("drops the musl binaries, which Electron never loads", () => {
    pruneSqlitePrebuilds(buildPath, "linux", "x64");

    expect(fs.existsSync(path.join(dir, "linuxmusl-x64.node"))).toBe(false);
  });

  it("refuses to package a target with no binary, and removes nothing", () => {
    expect(() => pruneSqlitePrebuilds(buildPath, "linux", "ia32")).toThrow(
      /no prebuild for linux-ia32/,
    );
    expect(fs.readdirSync(dir).sort()).toEqual(ALL_PREBUILDS);
  });

  it("does nothing when the package has no prebuilds folder", () => {
    fs.rmSync(dir, { recursive: true });

    expect(pruneSqlitePrebuilds(buildPath, "linux", "x64")).toEqual([]);
  });
});

describe("[Q-05] forge.config.cjs", () => {
  it("prunes better-sqlite3's prebuilds after packaging prunes", () => {
    const { buildPath, dir } = makeBuild();
    const config = require("../../forge.config.cjs") as {
      hooks: {
        packageAfterPrune: (
          config: unknown,
          buildPath: string,
          electronVersion: string,
          platform: string,
          arch: string,
        ) => void;
      };
    };

    try {
      config.hooks.packageAfterPrune(
        config,
        buildPath,
        "44.5.1",
        "linux",
        "x64",
      );
      expect(fs.readdirSync(dir)).toEqual(["linux-x64.node"]);
    } finally {
      fs.rmSync(buildPath, { force: true, recursive: true });
    }
  });
});
