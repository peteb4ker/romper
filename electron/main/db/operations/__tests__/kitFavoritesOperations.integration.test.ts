import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createRomperDbFile } from "../../utils/dbUtilities.js";
import { addKit } from "../kitCrudOperations.js";
import {
  getFavoriteKits,
  getFavoriteKitsCount,
  toggleKitFavorite,
} from "../kitFavoritesOperations.js";
import { addSample } from "../sampleCrudOperations.js";

describe("Kit Favorites Operations - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-kit-favs-"));
    dbDir = join(tempDir, ".romperdb");
    createRomperDbFile(dbDir);
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("toggleKitFavorite", () => {
    test("toggles non-favorite to favorite", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      const result = toggleKitFavorite(dbDir, "A0");
      expect(result.success).toBe(true);
      expect(result.data!.isFavorite).toBe(true);
    });

    test("toggles favorite back to non-favorite", () => {
      addKit(dbDir, { bank_letter: "A", is_favorite: true, name: "A0" });

      const result = toggleKitFavorite(dbDir, "A0");
      expect(result.success).toBe(true);
      expect(result.data!.isFavorite).toBe(false);
    });

    test("double toggle returns to original state", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      toggleKitFavorite(dbDir, "A0"); // false -> true
      const result = toggleKitFavorite(dbDir, "A0"); // true -> false
      expect(result.data!.isFavorite).toBe(false);
    });

    test("fails for non-existent kit", () => {
      const result = toggleKitFavorite(dbDir, "NonExistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("getFavoriteKits", () => {
    test("returns empty array when no favorites exist", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });

      const result = getFavoriteKits(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    test("returns only favorite kits", () => {
      addKit(dbDir, { bank_letter: "A", is_favorite: true, name: "A0" });
      addKit(dbDir, { bank_letter: "B", is_favorite: false, name: "B0" });
      addKit(dbDir, { bank_letter: "C", is_favorite: true, name: "C0" });

      const result = getFavoriteKits(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      const names = result.data!.map((k) => k.name).sort();
      expect(names).toEqual(["A0", "C0"]);
    });

    test("returns favorite kits with voices and samples", () => {
      addKit(dbDir, { bank_letter: "A", is_favorite: true, name: "A0" });
      addSample(dbDir, {
        filename: "kick.wav",
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/samples/kick.wav",
        voice_number: 1,
      });

      const result = getFavoriteKits(dbDir);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].voices).toHaveLength(4);
      expect(result.data![0].samples).toHaveLength(1);
      expect(result.data![0].samples![0].filename).toBe("kick.wav");
    });
  });

  describe("getFavoriteKitsCount", () => {
    test("returns 0 when no favorites exist", () => {
      const result = getFavoriteKitsCount(dbDir);
      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    test("returns correct count of favorites", () => {
      addKit(dbDir, { bank_letter: "A", is_favorite: true, name: "A0" });
      addKit(dbDir, { bank_letter: "B", is_favorite: false, name: "B0" });
      addKit(dbDir, { bank_letter: "C", is_favorite: true, name: "C0" });

      const result = getFavoriteKitsCount(dbDir);
      expect(result.data).toBe(2);
    });

    test("updates count after toggling favorites", () => {
      addKit(dbDir, { bank_letter: "A", name: "A0" });
      addKit(dbDir, { bank_letter: "B", name: "B0" });

      expect(getFavoriteKitsCount(dbDir).data).toBe(0);

      toggleKitFavorite(dbDir, "A0");
      expect(getFavoriteKitsCount(dbDir).data).toBe(1);

      toggleKitFavorite(dbDir, "B0");
      expect(getFavoriteKitsCount(dbDir).data).toBe(2);

      toggleKitFavorite(dbDir, "A0"); // Un-favorite
      expect(getFavoriteKitsCount(dbDir).data).toBe(1);
    });
  });
});
