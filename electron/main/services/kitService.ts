import * as path from "path";

import type { DbResult, NewKit } from "../../../shared/db/schema.js";
import { addKit, getKit } from "../db/romperDbCoreORM.js";

/**
 * Service for kit management operations
 * Extracted from ipcHandlers.ts to separate business logic from IPC routing
 */
export class KitService {
  private getLocalStorePath(
    inMemorySettings: Record<string, any>,
  ): string | null {
    return inMemorySettings.localStorePath || null;
  }

  private getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
  }

  private validateKitSlot(kitSlot: string): void {
    if (!/^\p{Lu}\d{1,2}$/u.test(kitSlot)) {
      throw new Error("Invalid kit slot. Use format A0-Z99.");
    }
  }

  /**
   * Create a new kit in the database
   * Kit creation is reference-only - no physical folders are created
   */
  createKit(
    inMemorySettings: Record<string, any>,
    kitSlot: string,
  ): DbResult<void> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    this.validateKitSlot(kitSlot);

    const dbPath = this.getDbPath(localStorePath);

    // Check if kit already exists in database
    const existingKit = getKit(dbPath, kitSlot);
    if (existingKit.success && existingKit.data) {
      return { success: false, error: "Kit already exists." };
    }

    // Create kit record in database only (no folder creation)
    const kitRecord: NewKit = {
      name: kitSlot,
      bank_letter: kitSlot.charAt(0), // Extract bank letter from kit name
      alias: null,
      editable: true, // User-created kits are editable by default
      locked: false,
      step_pattern: null,
      modified_since_sync: false,
    };

    const result = addKit(dbPath, kitRecord);
    if (!result.success) {
      return { success: false, error: `Failed to create kit: ${result.error}` };
    }

    return { success: true };
  }

  /**
   * Copy an existing kit to a new kit slot
   * Copies metadata and references, not physical files
   */
  copyKit(
    inMemorySettings: Record<string, any>,
    sourceKit: string,
    destKit: string,
  ): DbResult<void> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    this.validateKitSlot(sourceKit);
    this.validateKitSlot(destKit);

    const dbPath = this.getDbPath(localStorePath);

    // Check if source kit exists in database
    const sourceKitData = getKit(dbPath, sourceKit);
    if (!sourceKitData.success || !sourceKitData.data) {
      return { success: false, error: "Source kit does not exist." };
    }

    // Check if destination kit already exists in database
    const existingDestKit = getKit(dbPath, destKit);
    if (existingDestKit.success && existingDestKit.data) {
      return { success: false, error: "Destination kit already exists." };
    }

    // Copy kit metadata in database only (no folder copying)
    const destKitRecord: NewKit = {
      name: destKit,
      bank_letter: destKit.charAt(0), // Extract bank letter from kit name
      alias: destKit,
      editable: true, // Duplicated kits are editable by default
      locked: false,
      step_pattern: sourceKitData.data.step_pattern,
      modified_since_sync: false,
    };

    const result = addKit(dbPath, destKitRecord);
    if (!result.success) {
      return {
        success: false,
        error: `Failed to duplicate kit: ${result.error}`,
      };
    }

    // NOTE: Sample references are not copied as the kit duplication creates
    // empty kits that will be populated through the sample assignment system

    return { success: true };
  }
}

// Export singleton instance
export const kitService = new KitService();
