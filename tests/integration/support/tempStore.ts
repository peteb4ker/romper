// Temp stores for integration tests.
//
// The integration runner already closes every database connection when a
// test's body ends, before its afterEach hooks (see runner.ts).
// removeTempStore closes them again right before deleting, so it's also
// safe in afterAll, inside a test, or after an afterEach hook that used the
// database: Windows can't delete an open database file.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { closeAllDbConnections } from "../../../electron/main/db/utils/dbConnections.js";

/** Make an empty folder under the OS temp dir, named `<prefix>XXXXXX` */
export function createTempStore(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Close every database connection, then delete `dir` and everything in it.
 * Does nothing for a folder that was never made (a failed beforeEach).
 */
export function removeTempStore(dir: string | undefined): void {
  if (!dir) return;
  closeAllDbConnections();
  fs.rmSync(dir, { force: true, maxRetries: 5, recursive: true });
}
