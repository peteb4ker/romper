import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createStoreDb } from "../../../../../tests/integration/support/storeDb.js";
import {
  createTempStore,
  removeTempStore,
} from "../../../../../tests/integration/support/tempStore.js";
import { addKit } from "../kitCrudOperations.js";
import { toggleKitFavorite } from "../kitFavoritesOperations.js";

describe("[UC-10] Kit Favorites Operations - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;

  beforeEach(() => {
    tempDir = createTempStore("romper-kit-favs-");
    dbDir = join(tempDir, ".romperdb");
    createStoreDb(dbDir);
  });

  afterEach(() => {
    removeTempStore(tempDir);
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
});
