import fs from "node:fs";

import type { InMemorySettings, KnownSettings } from "./types/settings.js";

type KnownSettingKey = keyof KnownSettings;

const isOptionalPath = (value: unknown): boolean =>
  value === null || value === undefined || typeof value === "string";

/** What each known setting may hold. Anything else is refused (RE-21). */
const KNOWN_SETTING_CHECKS: Record<KnownSettingKey, (v: unknown) => boolean> = {
  confirmDestructiveActions: (v) => typeof v === "boolean",
  localStorePath: isOptionalPath,
  sdCardPath: isOptionalPath,
  themeMode: (v) => v === "dark" || v === "light" || v === "system",
};

export function isKnownSettingKey(key: string): key is KnownSettingKey {
  return Object.hasOwn(KNOWN_SETTING_CHECKS, key);
}

/**
 * Whether `value` may be saved under `key`. Known settings must have the
 * right type; other keys are kept as they are.
 */
export function isValidSettingValue(key: string, value: unknown): boolean {
  return isKnownSettingKey(key) ? KNOWN_SETTING_CHECKS[key](value) : true;
}

/**
 * Turn the parsed settings file into in-memory settings. Every key is kept,
 * known or not, except a known setting whose value has the wrong type,
 * which is dropped so its default applies.
 */
export function normalizeSettings(
  parsed: Record<string, unknown>,
): InMemorySettings {
  const settings: InMemorySettings = { localStorePath: null };
  for (const [key, value] of Object.entries(parsed)) {
    if (isValidSettingValue(key, value)) {
      settings[key] = value;
    } else {
      console.warn(
        `[Settings] Ignoring saved ${key}: ${JSON.stringify(value)} isn't a valid value`,
      );
    }
  }
  // An empty path means no store
  settings.localStorePath = settings.localStorePath || null;
  return settings;
}

/**
 * Write the settings file through a temporary file and a rename, so a crash
 * or a full disk mid-write leaves the old file whole instead of a truncated
 * one (RE-21).
 */
export function writeSettingsFile(
  settingsPath: string,
  settings: InMemorySettings,
): void {
  const tempPath = `${settingsPath}.${process.pid}.tmp`;
  try {
    const fd = fs.openSync(tempPath, "w");
    try {
      fs.writeFileSync(fd, JSON.stringify(settings, null, 2), "utf-8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, settingsPath);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
}
