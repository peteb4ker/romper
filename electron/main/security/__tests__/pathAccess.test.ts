import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertAllowed,
  canonicalizePath,
  checkDatabaseDirAccess,
  checkPathAccess,
  getDefaultLocalStorePath,
  isSameOrInside,
  pathAccess,
  PathAccessError,
  PathAccessPolicy,
} from "../pathAccess";

// Real filesystem: traversal and symlink handling is the point of the module.
describe("pathAccess (RE-03)", () => {
  let tmp: string;
  let store: string;
  let sdCard: string;
  let outside: string;
  let policy: PathAccessPolicy;
  let settings: Record<string, unknown>;
  const savedEnv = {
    local: process.env.ROMPER_LOCAL_PATH,
    sd: process.env.ROMPER_SDCARD_PATH,
  };

  beforeEach(() => {
    delete process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_SDCARD_PATH;
    // Not realpath'd on purpose: on macOS the tmpdir itself runs through the
    // /var -> /private/var symlink, so every test also covers symlinked roots.
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "romper-path-access-"));
    store = path.join(tmp, "store");
    sdCard = path.join(tmp, "sdcard");
    outside = path.join(tmp, "outside");
    for (const dir of [store, sdCard, outside]) fs.mkdirSync(dir);
    fs.writeFileSync(path.join(outside, "secret.txt"), "secret");
    settings = { localStorePath: store };
    policy = new PathAccessPolicy();
    policy.useSettings(settings);
  });

  afterEach(() => {
    fs.rmSync(tmp, { force: true, recursive: true });
    pathAccess.reset();
    restoreEnv("ROMPER_LOCAL_PATH", savedEnv.local);
    restoreEnv("ROMPER_SDCARD_PATH", savedEnv.sd);
  });

  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const allowed = (p: unknown, mode: "read" | "write" = "write") =>
    policy.check(p, mode).ok;

  describe("roots", () => {
    it("allows the configured local store and anything under it", () => {
      expect(allowed(store)).toBe(true);
      expect(allowed(path.join(store, "A0", "1 kick.wav"))).toBe(true);
      expect(allowed(path.join(store, ".romperdb"))).toBe(true);
    });

    it("allows paths that don't exist yet inside a root", () => {
      expect(allowed(path.join(store, "new", "deeper", "kit"))).toBe(true);
    });

    it("denies everything outside the roots", () => {
      expect(allowed(outside)).toBe(false);
      expect(allowed(path.join(outside, "secret.txt"), "read")).toBe(false);
      expect(allowed(tmp)).toBe(false);
      expect(allowed("/")).toBe(false);
      expect(allowed(os.homedir())).toBe(false);
    });

    it("reads the settings object live, so a switched store takes effect", () => {
      expect(allowed(sdCard)).toBe(false);
      settings.sdCardPath = sdCard;
      expect(allowed(path.join(sdCard, "A0"))).toBe(true);
      settings.localStorePath = null;
      expect(allowed(store)).toBe(false);
    });

    it("allows the ROMPER_LOCAL_PATH and ROMPER_SDCARD_PATH overrides", () => {
      policy.useSettings({});
      expect(allowed(store)).toBe(false);
      process.env.ROMPER_LOCAL_PATH = store;
      process.env.ROMPER_SDCARD_PATH = sdCard;
      expect(allowed(path.join(store, "A0"))).toBe(true);
      expect(allowed(path.join(sdCard, "B1"))).toBe(true);
    });

    it("uses only the active store: ROMPER_LOCAL_PATH replaces the saved one", () => {
      const envStore = path.join(tmp, "env-store");
      fs.mkdirSync(envStore);
      process.env.ROMPER_LOCAL_PATH = envStore;
      expect(allowed(path.join(envStore, "A0"))).toBe(true);
      expect(allowed(path.join(store, "A0"))).toBe(false);
    });

    it("ignores an empty ROMPER_LOCAL_PATH (the wizard trigger)", () => {
      process.env.ROMPER_LOCAL_PATH = "";
      policy.useSettings({});
      expect(policy.getRoots()).not.toContain("");
      expect(allowed("/")).toBe(false);
    });

    it("allows the wizard's default store location", () => {
      expect(allowed(getDefaultLocalStorePath())).toBe(true);
      expect(allowed(path.join(getDefaultLocalStorePath(), "A0"))).toBe(true);
      expect(getDefaultLocalStorePath()).toBe(
        path.join(os.homedir(), "Documents", "romper"),
      );
    });

    it("allows a dialog-granted folder for read and write", () => {
      const picked = path.join(tmp, "picked");
      expect(allowed(path.join(picked, "romper"))).toBe(false);
      policy.grantRoot(picked);
      expect(allowed(path.join(picked, "romper"))).toBe(true);
      expect(allowed(path.join(picked, "romper"), "read")).toBe(true);
    });

    it("ignores relative or empty grants", () => {
      policy.grantRoot("relative/dir");
      policy.grantRoot("");
      policy.grantRead(42);
      expect(policy.getRoots()).not.toContain("relative/dir");
    });

    it("forgets session grants on reset", () => {
      policy.grantRoot(outside);
      expect(allowed(outside)).toBe(true);
      policy.reset();
      expect(allowed(outside)).toBe(false);
      expect(allowed(store)).toBe(false); // settings are dropped too
    });
  });

  describe("traversal and prefix tricks", () => {
    it("resolves .. before checking", () => {
      expect(allowed(path.join(store, "..", "outside"))).toBe(false);
      expect(allowed(`${store}/A0/../../outside/secret.txt`, "read")).toBe(
        false,
      );
      expect(allowed(`${store}/A0/../B1`)).toBe(true);
    });

    it("does not treat a sibling with the root as a prefix as inside it", () => {
      const evil = `${store}-evil`;
      fs.mkdirSync(evil);
      expect(allowed(evil)).toBe(false);
      expect(allowed(path.join(evil, "payload"))).toBe(false);
      expect(allowed(`${store}evil`)).toBe(false);
    });

    it("rejects relative paths, empty values, non-strings and NUL bytes", () => {
      expect(allowed("store/A0")).toBe(false);
      expect(allowed("")).toBe(false);
      expect(allowed("   ")).toBe(false);
      expect(allowed(undefined)).toBe(false);
      expect(allowed(null)).toBe(false);
      expect(allowed({ path: store })).toBe(false);
      expect(allowed(`${store}/A0\0/../../outside`)).toBe(false);
    });
  });

  describe("symlinks", () => {
    it("denies a symlink inside a root that points outside it", () => {
      const link = path.join(store, "escape");
      fs.symlinkSync(outside, link);
      expect(allowed(link)).toBe(false);
      expect(allowed(path.join(link, "secret.txt"), "read")).toBe(false);
      expect(allowed(path.join(link, "new-dir"))).toBe(false);
    });

    it("denies a file symlink inside a root that points outside it", () => {
      const link = path.join(store, "secret.wav");
      fs.symlinkSync(path.join(outside, "secret.txt"), link);
      expect(allowed(link, "read")).toBe(false);
    });

    it("allows a symlink inside a root that stays inside it", () => {
      fs.mkdirSync(path.join(store, "A0"));
      fs.symlinkSync(path.join(store, "A0"), path.join(store, "alias"));
      expect(allowed(path.join(store, "alias", "1 kick.wav"))).toBe(true);
    });

    it("allows a root that is itself reached through a symlink", () => {
      const linkedStore = path.join(tmp, "linked-store");
      fs.symlinkSync(store, linkedStore);
      policy.useSettings({ localStorePath: linkedStore });
      expect(allowed(path.join(store, "A0"))).toBe(true);
      expect(allowed(path.join(linkedStore, "A0"))).toBe(true);
    });

    it("denies a path that runs through a dangling symlink", () => {
      const dangling = path.join(store, "dangling");
      fs.symlinkSync(path.join(outside, "does-not-exist"), dangling);
      expect(allowed(dangling)).toBe(false);
      expect(allowed(path.join(dangling, "child"))).toBe(false);
      expect(() => canonicalizePath(dangling)).toThrow(PathAccessError);
    });

    it("denies a symlink loop", () => {
      const loop = path.join(store, "loop");
      fs.symlinkSync(loop, loop);
      expect(allowed(path.join(loop, "x"))).toBe(false);
    });
  });

  describe("read-only grants", () => {
    it("allows reading a dropped file, but not writing it or its siblings", () => {
      const dropped = path.join(outside, "kick.wav");
      fs.writeFileSync(dropped, "RIFF");
      policy.grantRead(dropped);
      expect(allowed(dropped, "read")).toBe(true);
      expect(allowed(dropped, "write")).toBe(false);
      expect(allowed(path.join(outside, "secret.txt"), "read")).toBe(false);
      expect(allowed(outside, "read")).toBe(false);
    });
  });

  describe("helpers", () => {
    it("canonicalizePath resolves the existing part and keeps the tail", () => {
      const real = fs.realpathSync.native(store);
      expect(canonicalizePath(path.join(store, "a", "b"))).toBe(
        path.join(real, "a", "b"),
      );
      expect(canonicalizePath(`${store}/x/../y`)).toBe(path.join(real, "y"));
    });

    it("isSameOrInside handles equality, children, siblings and parents", () => {
      expect(isSameOrInside("/a/b", "/a/b")).toBe(true);
      expect(isSameOrInside("/a/b/c", "/a/b")).toBe(true);
      expect(isSameOrInside("/a/bc", "/a/b")).toBe(false);
      expect(isSameOrInside("/a", "/a/b")).toBe(false);
      expect(isSameOrInside("/a/b/..c", "/a/b")).toBe(true);
    });

    it.runIf(process.platform === "darwin")(
      "isSameOrInside ignores case on macOS",
      () => {
        expect(isSameOrInside("/Volumes/RAMPLE/A0", "/volumes/rample")).toBe(
          true,
        );
      },
    );

    it("checkDatabaseDirAccess requires a .romperdb folder in a writable root", () => {
      pathAccess.useSettings({ localStorePath: store });
      expect(checkDatabaseDirAccess(path.join(store, ".romperdb")).ok).toBe(
        true,
      );
      expect(checkDatabaseDirAccess(path.join(store, "db")).ok).toBe(false);
      expect(
        checkDatabaseDirAccess(path.join(store, ".romperdb", "..")).ok,
      ).toBe(false);
      expect(checkDatabaseDirAccess(path.join(outside, ".romperdb")).ok).toBe(
        false,
      );
      expect(checkDatabaseDirAccess(undefined).ok).toBe(false);
    });

    it("checkPathAccess and assertAllowed use the process-wide policy", () => {
      pathAccess.useSettings({ localStorePath: store });
      expect(checkPathAccess(path.join(store, "A0")).ok).toBe(true);
      expect(checkPathAccess(outside, { write: true }).ok).toBe(false);
      expect(() => assertAllowed(path.join(store, "A0"))).not.toThrow();
      expect(() => assertAllowed(outside, { write: true })).toThrow(
        PathAccessError,
      );
      const denied = checkPathAccess(outside, { write: true });
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.error).toMatch(/Access denied/);
    });
  });
});
