import type { DbResult, NewKit } from "@romper/shared/db/schema.js";

import * as path from "node:path";

import type { InMemorySettings } from "../types/settings.js";

import {
  addKit,
  copyKit as copyKitDb,
  deleteKit as deleteKitDb,
  getKit,
  getKitDeleteSummary as getKitDeleteSummaryDb,
} from "../db/romperDbCoreORM.js";

/**
 * Service for kit management operations
 * Extracted from ipcHandlers.ts to separate business logic from IPC routing
 */
export class KitService {
  /**
   * Copy an existing kit to a new kit slot
   * Copies metadata and references, not physical files
   */
  copyKit(
    inMemorySettings: InMemorySettings,
    sourceKit: string,
    destKit: string,
  ): DbResult<void> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    this.validateKitSlot(sourceKit);
    this.validateKitSlot(destKit);

    const dbPath = this.getDbPath(localStorePath);

    // The db layer copies kit, voices, and samples atomically with all
    // user-editable fields preserved (bpm, trigger conditions, voice
    // settings, sample gain and WAV metadata).
    return copyKitDb(dbPath, sourceKit, destKit);
  }

  /**
   * Create a new kit in the database
   * Kit creation is reference-only - no physical folders are created
   */
  createKit(
    inMemorySettings: InMemorySettings,
    kitSlot: string,
  ): DbResult<void> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    this.validateKitSlot(kitSlot);

    const dbPath = this.getDbPath(localStorePath);

    // Check if kit already exists in database
    const existingKit = getKit(dbPath, kitSlot);
    if (existingKit.success && existingKit.data) {
      return { error: "Kit already exists.", success: false };
    }

    // Create kit record in database only (no folder creation)
    const kitRecord: NewKit = {
      alias: null,
      bank_letter: kitSlot.charAt(0), // Extract bank letter from kit name
      editable: true, // User-created kits are editable by default
      locked: false,
      modified_since_sync: false,
      name: kitSlot,
      step_pattern: null,
    };

    const result = addKit(dbPath, kitRecord);
    if (!result.success) {
      return { error: `Failed to create kit: ${result.error}`, success: false };
    }

    return { success: true };
  }

  /**
   * Delete a kit and all its child records (samples, voices)
   * DB-only operation - no filesystem changes
   */
  deleteKit(
    inMemorySettings: InMemorySettings,
    kitName: string,
  ): DbResult<void> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    this.validateKitSlot(kitName);
    const dbPath = this.getDbPath(localStorePath);

    // Check kit exists and is not locked
    const kitResult = getKit(dbPath, kitName);
    if (!kitResult.success || !kitResult.data) {
      return { error: "Kit not found.", success: false };
    }

    if (kitResult.data.locked) {
      return {
        error: "Kit is locked. Unlock it before deleting.",
        success: false,
      };
    }

    return deleteKitDb(dbPath, kitName);
  }

  /**
   * Get summary of what would be deleted (for confirmation dialog)
   */
  getKitDeleteSummary(
    inMemorySettings: InMemorySettings,
    kitName: string,
  ): DbResult<{
    kitName: string;
    locked: boolean;
    sampleCount: number;
    voiceCount: number;
  }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    this.validateKitSlot(kitName);
    const dbPath = this.getDbPath(localStorePath);

    return getKitDeleteSummaryDb(dbPath, kitName);
  }

  private getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
  }

  private getLocalStorePath(inMemorySettings: InMemorySettings): null | string {
    return inMemorySettings.localStorePath;
  }

  private validateKitSlot(kitSlot: string): void {
    if (!/^\p{Lu}\d{1,2}$/u.test(kitSlot)) {
      throw new Error("Invalid kit slot. Use format A0-Z99.");
    }
  }
}

// Export singleton instance
export const kitService = new KitService();
