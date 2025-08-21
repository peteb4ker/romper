import type { DbResult, NewKit } from "@romper/shared/db/schema.js";

import * as path from "path";

import { addKit, getKit } from "../db/romperDbCoreORM.js";

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
    inMemorySettings: Record<string, unknown>,
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

    // Check if source kit exists in database
    const sourceKitData = getKit(dbPath, sourceKit);
    if (!sourceKitData.success || !sourceKitData.data) {
      return { error: "Source kit does not exist.", success: false };
    }

    // Check if destination kit already exists in database
    const existingDestKit = getKit(dbPath, destKit);
    if (existingDestKit.success && existingDestKit.data) {
      return { error: "Destination kit already exists.", success: false };
    }

    // Copy kit metadata in database only (no folder copying)
    const destKitRecord: NewKit = {
      alias: destKit,
      bank_letter: destKit.charAt(0), // Extract bank letter from kit name
      editable: true, // Duplicated kits are editable by default
      locked: false,
      modified_since_sync: false,
      name: destKit,
      step_pattern: sourceKitData.data.step_pattern,
    };

    const result = addKit(dbPath, destKitRecord);
    if (!result.success) {
      return {
        error: `Failed to duplicate kit: ${result.error}`,
        success: false,
      };
    }

    // NOTE: Sample references are not copied as the kit duplication creates
    // empty kits that will be populated through the sample assignment system

    return { success: true };
  }

  /**
   * Create a new kit in the database
   * Kit creation is reference-only - no physical folders are created
   */
  createKit(
    inMemorySettings: Record<string, unknown>,
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

  private getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
  }

  private getLocalStorePath(
    inMemorySettings: Record<string, unknown>,
  ): null | string {
    const path = inMemorySettings.localStorePath;
    return typeof path === 'string' ? path : null;
  }

  private validateKitSlot(kitSlot: string): void {
    if (!/^\p{Lu}\d{1,2}$/u.test(kitSlot)) {
      throw new Error("Invalid kit slot. Use format A0-Z99.");
    }
  }
}

// Export singleton instance
export const kitService = new KitService();
