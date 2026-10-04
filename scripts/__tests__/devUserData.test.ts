// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  installedUserDataDir,
  prepareDevUserDataDir,
} from "../dev-user-data.mjs";

// #546: npm run dev used the installed app's userData, so a dev session's
// settings changes reached the installed app.
describe("[Q-07] dev userData", () => {
  let home: string;
  let projectRoot: string;
  const log = () => {};

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "romper-dev-home-"));
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "romper-dev-root-"));
  });

  afterEach(() => {
    fs.rmSync(home, { force: true, recursive: true });
    fs.rmSync(projectRoot, { force: true, recursive: true });
  });

  function writeInstalledSettings(contents: object) {
    const dir = installedUserDataDir({
      env: {},
      homedir: home,
      platform: "linux",
    });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "romper-settings.json"),
      JSON.stringify(contents),
    );
    return dir;
  }

  function prepare(env: Record<string, string> = {}) {
    return prepareDevUserDataDir({
      env,
      homedir: home,
      log,
      platform: "linux",
      projectRoot,
    });
  }

  it("finds the installed app's folder on each platform", () => {
    expect(
      installedUserDataDir({ env: {}, homedir: "/h", platform: "darwin" }),
    ).toBe(path.join("/h", "Library", "Application Support", "Romper"));
    expect(
      installedUserDataDir({
        env: { APPDATA: "/appdata" },
        homedir: "/h",
        platform: "win32",
      }),
    ).toBe(path.join("/appdata", "Romper"));
    expect(
      installedUserDataDir({ env: {}, homedir: "/h", platform: "linux" }),
    ).toBe(path.join("/h", ".config", "Romper"));
    expect(
      installedUserDataDir({
        env: { XDG_CONFIG_HOME: "/xdg" },
        homedir: "/h",
        platform: "linux",
      }),
    ).toBe(path.join("/xdg", "Romper"));
  });

  it("keeps the worktree's own folder, starting from the installed settings", () => {
    writeInstalledSettings({ localStorePath: "/library" });

    const dir = prepare();

    expect(dir).toBe(path.join(projectRoot, ".romper-dev", "user-data"));
    expect(
      JSON.parse(
        fs.readFileSync(path.join(dir, "romper-settings.json"), "utf8"),
      ),
    ).toEqual({ localStorePath: "/library" });
  });

  it("copies only once, so the dev app's own changes stay", () => {
    const installed = writeInstalledSettings({ localStorePath: "/library" });
    const dir = prepare();
    fs.writeFileSync(
      path.join(dir, "romper-settings.json"),
      JSON.stringify({ localStorePath: "/dev-library" }),
    );

    expect(prepare()).toBe(dir);

    expect(
      JSON.parse(
        fs.readFileSync(path.join(dir, "romper-settings.json"), "utf8"),
      ),
    ).toEqual({ localStorePath: "/dev-library" });
    expect(
      JSON.parse(
        fs.readFileSync(path.join(installed, "romper-settings.json"), "utf8"),
      ),
    ).toEqual({ localStorePath: "/library" });
  });

  it("starts empty when there's no installed app", () => {
    const dir = prepare();

    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("honours ROMPER_USER_DATA_DIR", () => {
    writeInstalledSettings({ localStorePath: "/library" });

    expect(prepare({ ROMPER_USER_DATA_DIR: "/elsewhere" })).toBe("/elsewhere");
    expect(fs.existsSync(path.join(projectRoot, ".romper-dev"))).toBe(false);
  });
});
