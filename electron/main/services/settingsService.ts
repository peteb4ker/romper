import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

import type { InMemorySettings } from "../types/settings.js";

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
   * Write a setting value to both memory and persistent storage
   */
  writeSetting(
    inMemorySettings: InMemorySettings,
    key: string,
    value: unknown,
  ): void {
    console.log(
      "[SettingsService] write-setting called with key:",
      key,
      "value:",
      value,
    );

    const settingsPath = this.getSettingsPath();
    console.log("[SettingsService] Settings path:", settingsPath);

    // Update in-memory settings
    inMemorySettings[key] = value;
    console.log(
      "[SettingsService] Updated inMemorySettings:",
      inMemorySettings,
    );

    // Write to persistent storage
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(inMemorySettings, null, 2),
      "utf-8",
    );
    console.log("[SettingsService] Settings written to file");
  }

  private getSettingsPath(): string {
    const userDataPath = app.getPath("userData");
    return path.join(userDataPath, "romper-settings.json");
  }
}

// Export singleton instance
export const settingsService = new SettingsService();
