import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Open a test store's database the way the app opens it: waiting up to 5s
 * for a lock (busy_timeout, as in dbUtilities.ts) rather than failing at once
 * with "database is locked" while the app is writing (#671).
 */
export function openStoreDb(
  storePath: string,
  options: { readOnly?: boolean } = {},
): DatabaseSync {
  const db = new DatabaseSync(
    path.join(storePath, ".romperdb", "romper.sqlite"),
    options,
  );
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}
