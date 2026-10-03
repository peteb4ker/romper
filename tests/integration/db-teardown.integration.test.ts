// Regression guard for the shared integration teardown. Each store keeps
// its database connection open (RE-81), and Windows can't delete an open
// database file, so a temp store deleted with its connection still open
// fails there with EPERM. These tests delete stores without closing first
// and rely on the shared teardown to do it. On Windows CI
// (integration-tests (windows-latest)) a missing close fails the delete;
// elsewhere the connection-count checks catch it.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  getOpenDbConnection,
  openDbConnectionCount,
} from "../../electron/main/db/utils/dbConnections.js";
import { createRomperDbFile } from "../../electron/main/db/utils/dbUtilities.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

/** Create the store's database, leaving its connection open */
function openStoreDb(store: string): string {
  const dbDir = path.join(store, ".romperdb");
  const result = createRomperDbFile(dbDir);
  expect(result.success).toBe(true);
  expect(getOpenDbConnection(dbDir)).toBeDefined();
  return dbDir;
}

describe("[Q-07] Temp stores are deleted with their database closed", () => {
  it("removeTempStore closes the open connection, then deletes the store", () => {
    const store = createTempStore("db-teardown-helper-");
    const dbDir = openStoreDb(store);

    removeTempStore(store);

    expect(getOpenDbConnection(dbDir)).toBeUndefined();
    expect(fs.existsSync(store)).toBe(false);
  });

  describe("a test's own afterEach that deletes without closing", () => {
    let store: string | undefined;

    afterEach(() => {
      // The integration runner closed every connection when the test body
      // ended, before this hook
      expect(openDbConnectionCount()).toBe(0);
      // A plain delete with no close first, the way a new test might write it
      fs.rmSync(store!, { force: true, recursive: true });
      expect(fs.existsSync(store!)).toBe(false);
      store = undefined;
    });

    it("finds the connection closed and deletes the store", () => {
      store = createTempStore("db-teardown-own-");
      openStoreDb(store);
      expect(openDbConnectionCount()).toBe(1);
    });

    it("finds every connection closed when the test opened several", () => {
      store = createTempStore("db-teardown-several-");
      openStoreDb(path.join(store, "first"));
      openStoreDb(path.join(store, "second"));
      expect(openDbConnectionCount()).toBe(2);
    });
  });
});
