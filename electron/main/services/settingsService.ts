import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

/**
 * Service for application settings management
 * Extracted from ipcHandlers.ts to separate business logic from IPC routing
 */
export class SettingsService {
  private getSettingsPath(): string {
    const userDataPath = app.getPath("userData");
    return path.join(userDataPath, "romper-settings.json");
  }

  /**
   * Read current in-memory settings
   */
  readSettings(inMemorySettings: Record<string, any>): Record<string, any> {
    return inMemorySettings;
  }

  /**
   * Write a setting value to both memory and persistent storage
   */
  writeSetting(
    inMemorySettings: Record<string, any>,
    key: string,
    value: any,
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

  /**
   * Get the local store path with environment variable override support
   */
  getLocalStorePath(
    inMemorySettings: Record<string, any>,
    envOverride?: string,
  ): string | null {
    return envOverride || inMemorySettings.localStorePath || null;
  }

  /**
   * Validate that a local store path is configured
   */
  validateLocalStorePath(
    inMemorySettings: Record<string, any>,
    envOverride?: string,
  ): { success: true; path: string } | { success: false; error: string } {
    const localStorePath = this.getLocalStorePath(
      inMemorySettings,
      envOverride,
    );

    if (!localStorePath) {
      return { success: false, error: "No local store configured" };
    }

    return { success: true, path: localStorePath };
  }
}

// Export singleton instance
export const settingsService = new SettingsService();
