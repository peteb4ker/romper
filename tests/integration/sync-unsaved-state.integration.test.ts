/**
 * Integration test to verify that unsaved state is cleared after sync completion
 */

import type { Kit } from "@romper/shared/db/schema";

import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteDbFileWithRetry } from "../../electron/main/db/fileOperations";
import {
  addKit,
  addSample,
  clearMigrationCache,
  createRomperDbFile,
  getKit,
  markKitAsModified,
  markKitsAsSynced,
} from "../../electron/main/db/romperDbCoreORM";

describe("Sync Unsaved State Integration", () => {
  const TEST_DB_DIR = path.join(__dirname, "sync-test-data");

  async function cleanupSqliteFiles(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await cleanupSqliteFiles(fullPath);
      } else if (entry.name.endsWith(".sqlite")) {
        try {
          await deleteDbFileWithRetry(fullPath);
        } catch (error) {
          console.warn(`Failed to delete SQLite file ${fullPath}:`, error);
        }
      }
    }
  }

  beforeEach(() => {
    // Clear migration cache to ensure fresh database setup
    clearMigrationCache();
    // Ensure the test directory exists
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    // Create a fresh database
    const dbResult = createRomperDbFile(TEST_DB_DIR);
    if (!dbResult.success) {
      throw new Error("Database setup failed: " + dbResult.error);
    }
  });

  afterEach(async () => {
    await cleanupSqliteFiles(TEST_DB_DIR);
  });

  it("should clear modified_since_sync flag when kit is marked as synced", () => {
    // Create a test kit
    const testKit: Omit<
      Kit,
      "created_at" | "id" | "scanned_at" | "updated_at"
    > = {
      alias: null,
      bank_letter: "A",
      editable: true,
      is_favorite: false,
      locked: false,
      modified_since_sync: false,
      name: "TestKit",
      step_pattern: null,
    };

    const addResult = addKit(TEST_DB_DIR, testKit);
    if (!addResult.success) {
      throw new Error("addKit failed: " + addResult.error);
    }
    expect(addResult.success).toBe(true);

    // Verify kit starts as not modified
    const initialKit = getKit(TEST_DB_DIR, "TestKit");
    expect(initialKit.success).toBe(true);
    expect(initialKit.data?.modified_since_sync).toBe(false);

    // Add a sample to the kit
    const sampleResult = addSample(TEST_DB_DIR, {
      filename: "test.wav",
      kit_name: "TestKit",
      mono: false,
      sample_rate: 44100,
      slot_number: 0,
      source_path: "/test/path/test.wav",
      voice_number: 1,
    });
    expect(sampleResult.success).toBe(true);

    // Mark kit as modified (this normally happens in the service layer)
    const modifyResult = markKitAsModified(TEST_DB_DIR, "TestKit");
    expect(modifyResult.success).toBe(true);

    // Verify kit is now marked as modified
    const modifiedKit = getKit(TEST_DB_DIR, "TestKit");
    expect(modifiedKit.success).toBe(true);
    expect(modifiedKit.data?.modified_since_sync).toBe(true);

    // Simulate sync completion by marking kit as synced
    const syncResult = markKitsAsSynced(TEST_DB_DIR, ["TestKit"]);
    expect(syncResult.success).toBe(true);

    // Verify kit is no longer marked as modified
    const syncedKit = getKit(TEST_DB_DIR, "TestKit");
    expect(syncedKit.success).toBe(true);
    expect(syncedKit.data?.modified_since_sync).toBe(false);
  });

  it("should handle multiple kits being marked as synced", () => {
    // Create multiple test kits
    const kit1: Omit<Kit, "created_at" | "id" | "scanned_at" | "updated_at"> = {
      alias: null,
      bank_letter: "A",
      editable: true,
      is_favorite: false,
      locked: false,
      modified_since_sync: false,
      name: "TestKit1",
      step_pattern: null,
    };

    const kit2: Omit<Kit, "created_at" | "id" | "scanned_at" | "updated_at"> = {
      alias: null,
      bank_letter: "A",
      editable: true,
      is_favorite: false,
      locked: false,
      modified_since_sync: false,
      name: "TestKit2",
      step_pattern: null,
    };

    addKit(TEST_DB_DIR, kit1);
    addKit(TEST_DB_DIR, kit2);

    // Mark both kits as modified
    const mod1 = markKitAsModified(TEST_DB_DIR, "TestKit1");
    const mod2 = markKitAsModified(TEST_DB_DIR, "TestKit2");
    expect(mod1.success).toBe(true);
    expect(mod2.success).toBe(true);

    // Verify both are marked as modified
    const modKit1 = getKit(TEST_DB_DIR, "TestKit1");
    const modKit2 = getKit(TEST_DB_DIR, "TestKit2");
    expect(modKit1.data?.modified_since_sync).toBe(true);
    expect(modKit2.data?.modified_since_sync).toBe(true);

    // Mark both as synced
    const syncResult = markKitsAsSynced(TEST_DB_DIR, ["TestKit1", "TestKit2"]);
    expect(syncResult.success).toBe(true);

    // Verify both are no longer marked as modified
    const syncedKit1 = getKit(TEST_DB_DIR, "TestKit1");
    const syncedKit2 = getKit(TEST_DB_DIR, "TestKit2");
    expect(syncedKit1.data?.modified_since_sync).toBe(false);
    expect(syncedKit2.data?.modified_since_sync).toBe(false);
  });

  it("should handle non-existent kits gracefully", () => {
    // Try to mark a non-existent kit as synced
    const syncResult = markKitsAsSynced(TEST_DB_DIR, ["NonExistentKit"]);
    expect(syncResult.success).toBe(true); // Should not fail the entire operation

    // Create one real kit and one fake kit name
    const testKit: Omit<
      Kit,
      "created_at" | "id" | "scanned_at" | "updated_at"
    > = {
      alias: null,
      bank_letter: "A",
      editable: true,
      is_favorite: false,
      locked: false,
      modified_since_sync: false,
      name: "RealKit",
      step_pattern: null,
    };

    addKit(TEST_DB_DIR, testKit);
    markKitAsModified(TEST_DB_DIR, "RealKit");

    // Try to sync both real and fake kit
    const mixedSyncResult = markKitsAsSynced(TEST_DB_DIR, [
      "RealKit",
      "FakeKit",
    ]);
    expect(mixedSyncResult.success).toBe(true);

    // Verify real kit was updated properly
    const realKit = getKit(TEST_DB_DIR, "RealKit");
    expect(realKit.data?.modified_since_sync).toBe(false);
  });
});
