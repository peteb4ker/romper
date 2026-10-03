import { app } from "electron";
import * as path from "node:path";

import type { InMemorySettings } from "../types/settings.js";

import { isValidSettingValue, writeSettingsFile } from "../settingsFile.js";
import { logger } from "../utils/logger.js";

/**
 * Service for application settings management
 * Extracted from ipcHandlers.ts to separate business logic from IPC routing
 */
export class SettingsService {
  /**
   * Get the local store path with environment variable override support
   */
  getLocalStorePath(
    inMemorySettings: InMemorySettings,
    envOverride?: string,
  ): null | string {
    return envOverride || inMemorySettings.localStorePath || null;
  }

  /**
   * Read current in-memory settings with environment overrides
   */
  readSettings(inMemorySettings: InMemorySettings): InMemorySettings {
    // Include environment overrides when available
    const settings = { ...inMemorySettings };

    // Override with environment variables if available
    if (process.env.ROMPER_LOCAL_PATH) {
      settings.localStorePath = process.env.ROMPER_LOCAL_PATH;
    }

    if (process.env.ROMPER_SDCARD_PATH) {
      settings.sdCardPath = process.env.ROMPER_SDCARD_PATH;
    }

    return settings;
  }

  /**
   * Validate that a local store path is configured
   */
  validateLocalStorePath(
    inMemorySettings: InMemorySettings,
    envOverride?: string,
  ): { error: string; success: false } | { path: string; success: true } {
    const localStorePath = this.getLocalStorePath(
      inMemorySettings,
      envOverride,
    );

    if (!localStorePath) {
      return { error: "No local store configured", success: false };
    }

    return { path: localStorePath, success: true };
  }

  /**
   * Write a setting value to both memory and persistent storage. The whole
   * file is rewritten, keeping every other setting, through a temporary file
   * and a rename (RE-21). Memory changes only once the file is saved.
   */
  writeSetting(
    inMemorySettings: InMemorySettings,
    key: string,
    value: unknown,
  ): void {
    logger.log(
      "[SettingsService] write-setting called with key:",
      key,
      "value:",
      value,
    );

    if (!isValidSettingValue(key, value)) {
      throw new Error(`Invalid value for setting ${key}`);
    }

    const settingsPath = this.getSettingsPath();
    logger.log("[SettingsService] Settings path:", settingsPath);

    writeSettingsFile(settingsPath, { ...inMemorySettings, [key]: value });
    inMemorySettings[key] = value;
    logger.log("[SettingsService] Settings written to file");
  }

  private getSettingsPath(): string {
    const userDataPath = app.getPath("userData");
    return path.join(userDataPath, "romper-settings.json");
  }
}

// Export singleton instance
export const settingsService = new SettingsService();
