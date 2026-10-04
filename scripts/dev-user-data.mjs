// Where `npm run dev` keeps the app's userData: settings
// (romper-settings.json), window state and Chromium's profile.
//
// Main names the app "Romper", so without ROMPER_USER_DATA_DIR a run from
// source shares the installed app's userData folder, and anything it changes
// (the local store, the theme, a rerun of the setup wizard) changes the
// installed app too (#546). Each worktree gets its own folder instead, like
// the e2e suite. On first use it starts from a copy of the installed app's
// settings, so the dev app still opens the user's library.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SETTINGS_FILE = "romper-settings.json";

/** The installed app's userData folder, which a dev run only reads from */
export function installedUserDataDir({
  env = process.env,
  homedir = os.homedir(),
  platform = process.platform,
} = {}) {
  const appData =
    platform === "darwin"
      ? path.join(homedir, "Library", "Application Support")
      : platform === "win32"
        ? (env.APPDATA ?? path.join(homedir, "AppData", "Roaming"))
        : (env.XDG_CONFIG_HOME ?? path.join(homedir, ".config"));
  return path.join(appData, "Romper");
}

/**
 * The userData folder for a dev run from projectRoot: ROMPER_USER_DATA_DIR
 * when it's set, else `.romper-dev/user-data` in the worktree (ignored by
 * git), seeded with the installed app's settings the first time.
 */
export function prepareDevUserDataDir({
  env = process.env,
  homedir = os.homedir(),
  log = console.log,
  platform = process.platform,
  projectRoot,
}) {
  if (env.ROMPER_USER_DATA_DIR) {
    log(`[dev] userData: ${env.ROMPER_USER_DATA_DIR} (ROMPER_USER_DATA_DIR)`);
    return env.ROMPER_USER_DATA_DIR;
  }

  const dir = path.join(projectRoot, ".romper-dev", "user-data");
  const settings = path.join(dir, SETTINGS_FILE);
  if (fs.existsSync(settings)) {
    log(`[dev] userData: ${dir}`);
    return dir;
  }

  fs.mkdirSync(dir, { recursive: true });
  const installed = path.join(
    installedUserDataDir({ env, homedir, platform }),
    SETTINGS_FILE,
  );
  if (fs.existsSync(installed)) {
    fs.copyFileSync(installed, settings);
    log(`[dev] userData: ${dir} (settings copied from ${installed})`);
  } else {
    log(`[dev] userData: ${dir} (new: no installed settings to copy)`);
  }
  return dir;
}
