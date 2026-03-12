import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createRomperDbFile } from "../../utils/dbUtilities.js";
import { addKit, getKit } from "../kitCrudOperations.js";
import {
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
} from "../kitSyncOperations.js";

describe("Kit Sync Operations - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-kit-sync-"));
    dbDir = join(tempDir, ".romperdb");
    createRomperDbFile(dbDir);
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("markKitAsModified", () => {
    test("sets modified_since_sync to true", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      // Verify default is false
      let kit = getKit(dbDir, "A0");
      expect(kit.data!.modified_since_sync).toBe(false);

      const result = markKitAsModified(dbDir, "A0");
      expect(result.success).toBe(true);

      kit = getKit(dbDir, "A0");
      expect(kit.data!.modified_since_sync).toBe(true);
    });

    test("is idempotent - calling twice still results in true", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      markKitAsModified(dbDir, "A0");
      markKitAsModified(dbDir, "A0");

      const kit = getKit(dbDir, "A0");
      expect(kit.data!.modified_since_sync).toBe(true);
    });
  });

  describe("markKitAsSynced", () => {
    test("sets modified_since_sync to false", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      markKitAsModified(dbDir, "A0");

      const result = markKitAsSynced(dbDir, "A0");
      expect(result.success).toBe(true);

      const kit = getKit(dbDir, "A0");
      expect(kit.data!.modified_since_sync).toBe(false);
    });

    test("is idempotent - calling on already-synced kit is fine", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      // Kit starts with modified_since_sync = false
      markKitAsSynced(dbDir, "A0");

      const kit = getKit(dbDir, "A0");
      expect(kit.data!.modified_since_sync).toBe(false);
    });
  });

  describe("markKitsAsSynced", () => {
    test("marks multiple kits as synced in one operation", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      addKit(dbDir, { bank_letter: "B", name: "B0" });
      addKit(dbDir, { bank_letter: "C", name: "C0" });

      markKitAsModified(dbDir, "A0");
      markKitAsModified(dbDir, "B0");
      markKitAsModified(dbDir, "C0");

      const result = markKitsAsSynced(dbDir, ["A0", "B0", "C0"]);
      expect(result.success).toBe(true);

      const kitA = getKit(dbDir, "A0");
      const kitB = getKit(dbDir, "B0");
      const kitC = getKit(dbDir, "C0");
      expect(kitA.data!.modified_since_sync).toBe(false);
      expect(kitB.data!.modified_since_sync).toBe(false);
      expect(kitC.data!.modified_since_sync).toBe(false);
    });

    test("handles empty array without error", () => {
      const result = markKitsAsSynced(dbDir, []);
      expect(result.success).toBe(true);
    });

    test("only affects specified kits", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      addKit(dbDir, { bank_letter: "B", name: "B0" });

      markKitAsModified(dbDir, "A0");
      markKitAsModified(dbDir, "B0");

      markKitsAsSynced(dbDir, ["A0"]);

      const kitA = getKit(dbDir, "A0");
      const kitB = getKit(dbDir, "B0");
      expect(kitA.data!.modified_since_sync).toBe(false);
      expect(kitB.data!.modified_since_sync).toBe(true); // Unchanged
    });
  });
});
