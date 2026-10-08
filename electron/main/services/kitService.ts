import type {
  DbResult,
  KitWithRelations,
  NewKit,
} from "@romper/shared/db/schema.js";

import { isKitName } from "@romper/shared/rampleCardLayout.js";

import type { InMemorySettings } from "../types/settings.js";

import { kitNotEditableError } from "../db/operations/kitEditableGuard.js";
import {
  addKit,
  copyKit as copyKitDb,
  deleteKit as deleteKitDb,
  getKit,
  getKitDeleteSummary as getKitDeleteSummaryDb,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";

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
  ): DbResult<KitWithRelations> {
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
    return this.withNewKit(
      dbPath,
      destKit,
      copyKitDb(dbPath, sourceKit, destKit),
    );
  }

  /**
   * Create a new kit in the database
   * Kit creation is reference-only - no physical folders are created
   */
  createKit(
    inMemorySettings: InMemorySettings,
    kitSlot: string,
  ): DbResult<KitWithRelations> {
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
      modified_since_sync: true, // New since the last write (RE-35)
      name: kitSlot,
      step_pattern: null,
    };

    const result = addKit(dbPath, kitRecord);
    if (!result.success) {
      return { error: `Failed to create kit: ${result.error}`, success: false };
    }

    return this.withNewKit(dbPath, kitSlot, result);
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

    // Deleting is an edit the kit editor offers only on an editable kit
    // (#572). Locked is a separate flag.
    if (!kitResult.data.editable) {
      return { error: kitNotEditableError(kitName), success: false };
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
    return ServicePathManager.getDbPath(localStorePath);
  }

  private getLocalStorePath(inMemorySettings: InMemorySettings): null | string {
    return ServicePathManager.getLocalStorePath(inMemorySettings);
  }

  private validateKitSlot(kitSlot: string): void {
    if (!isKitName(kitSlot)) {
      throw new Error("Invalid kit slot. Use format A0-Z99.");
    }
  }

  /**
   * A new kit's result with the kit as it was created, samples and all, so
   * the renderer adds it to the list instead of reading every kit again
   * (#452). If it can't be read back, no kit comes with it and the
   * renderer reloads the kits.
   */
  private withNewKit(
    dbPath: string,
    kitName: string,
    result: DbResult<unknown>,
  ): DbResult<KitWithRelations> {
    if (!result.success) return { error: result.error, success: false };
    const kit = getKit(dbPath, kitName);
    return kit.success && kit.data?.samples
      ? { data: kit.data, success: true }
      : { success: true };
  }
}

// Export singleton instance
export const kitService = new KitService();
