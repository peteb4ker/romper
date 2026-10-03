import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    // RE-85: roots are canonicalised once per change, so these pin that a
    // cached root never widens access, and that the target is still
    // resolved on every check
    it("[Q-03] denies a path through a store symlink re-pointed outside after a check", () => {
      const linkedStore = path.join(tmp, "linked-store");
      fs.symlinkSync(store, linkedStore);
      policy.useSettings({ localStorePath: linkedStore });
      expect(allowed(path.join(linkedStore, "A0"))).toBe(true);

      fs.unlinkSync(linkedStore);
      fs.symlinkSync(outside, linkedStore);

      expect(allowed(path.join(linkedStore, "secret.txt"), "read")).toBe(false);
      expect(allowed(path.join(linkedStore, "new-dir"))).toBe(false);
    });

    it("[Q-03] denies a symlink planted in a root after the roots were resolved", () => {
      expect(allowed(path.join(store, "A0"))).toBe(true);
      const link = path.join(store, "late-escape");
      fs.symlinkSync(outside, link);
      expect(allowed(path.join(link, "secret.txt"), "read")).toBe(false);
    });

    it("[Q-03] re-resolves the roots when a setting changes in place", () => {
      const other = path.join(tmp, "other-store");
      const otherLink = path.join(tmp, "other-link");
      fs.mkdirSync(other);
      fs.symlinkSync(other, otherLink);
      expect(allowed(path.join(other, "A0"))).toBe(false);
      settings.localStorePath = otherLink;
      expect(allowed(path.join(other, "A0"))).toBe(true);
      expect(allowed(path.join(store, "A0"))).toBe(false);
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

    it("[Q-03] allows what's under a granted folder, but not a symlink out of it", () => {
      const library = path.join(tmp, "library");
      fs.mkdirSync(path.join(library, "drums"), { recursive: true });
      fs.symlinkSync(outside, path.join(library, "escape"));
      policy.grantRead(library);
      expect(allowed(path.join(library, "drums", "kick.wav"), "read")).toBe(
        true,
      );
      expect(allowed(path.join(library, "escape", "secret.txt"), "read")).toBe(
        false,
      );
    });

    it("[Q-03] grants the file a symlink pointed to when it was granted, not its later target", () => {
      const sample = path.join(tmp, "sample.wav");
      const link = path.join(tmp, "dropped.wav");
      fs.writeFileSync(sample, "RIFF");
      fs.symlinkSync(sample, link);
      policy.grantRead(link);
      expect(allowed(sample, "read")).toBe(true);

      fs.unlinkSync(link);
      fs.symlinkSync(path.join(outside, "secret.txt"), link);

      expect(allowed(link, "read")).toBe(false);
      expect(allowed(path.join(outside, "secret.txt"), "read")).toBe(false);
    });

    it("[Q-03] grants nothing for a dangling symlink, even once its target appears", () => {
      const dangling = path.join(tmp, "dangling.wav");
      const target = path.join(outside, "later.wav");
      fs.symlinkSync(target, dangling);
      policy.grantRead(dangling);
      fs.writeFileSync(target, "RIFF");
      expect(allowed(dangling, "read")).toBe(false);
      expect(allowed(target, "read")).toBe(false);
    });

    it("[Q-03] matches grants by case where the filesystem ignores it", () => {
      const dropped = path.join(outside, "Kick.wav");
      fs.writeFileSync(dropped, "RIFF");
      policy.grantRead(dropped);
      const otherCase = path.join(outside, "KICK.WAV");
      expect(allowed(otherCase, "read")).toBe(
        process.platform === "darwin" || process.platform === "win32",
      );
    });
  });

  // RE-85: a check used to resolve every root and every granted file, and
  // grants pile up as kits are edited. Now a check resolves the target only.
  describe("[Q-01] cost of a check", () => {
    const GRANTS = 500;
    let library: string;
    let realpath: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      library = path.join(tmp, "library");
      fs.mkdirSync(library);
      for (let i = 0; i < GRANTS; i++) {
        const file = path.join(library, `${i}.wav`);
        fs.writeFileSync(file, "RIFF");
        policy.grantRead(file);
      }
      realpath = vi.spyOn(fs.realpathSync, "native");
    });

    afterEach(() => {
      realpath.mockRestore();
    });

    it("resolves only the target, however many files are granted", () => {
      // The first check resolves the roots, once
      expect(allowed(path.join(store, "A0"))).toBe(true);
      realpath.mockClear();

      expect(allowed(path.join(library, "250.wav"), "read")).toBe(true);
      expect(allowed(path.join(outside, "secret.txt"), "read")).toBe(false);
      expect(allowed(path.join(store, "kick.wav"), "read")).toBe(true);

      // One call per existing target; a path that doesn't exist yet walks
      // up to its nearest existing folder
      expect(realpath.mock.calls.length).toBeLessThanOrEqual(6);
    });

    it("doesn't resolve a file again when it's granted again", () => {
      realpath.mockClear();
      for (let i = 0; i < GRANTS; i++) {
        policy.grantRead(path.join(library, `${i}.wav`));
      }
      expect(realpath).not.toHaveBeenCalled();
    });

    it("resolves the roots again only when they change", () => {
      allowed(store);
      realpath.mockClear();
      for (let i = 0; i < 20; i++) allowed(path.join(store, "A0"));
      const perCheck = realpath.mock.calls.length / 20;
      expect(perCheck).toBeLessThanOrEqual(2);

      realpath.mockClear();
      settings.sdCardPath = sdCard;
      expect(allowed(path.join(sdCard, "A0"))).toBe(true);
      // The new set of roots is resolved once, then checks are cheap again
      expect(realpath.mock.calls.length).toBeGreaterThan(perCheck * 2);
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
