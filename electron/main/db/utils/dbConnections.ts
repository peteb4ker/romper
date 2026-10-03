// The open database connections, one per local store (RE-81).
//
// This module only keeps the registry and closes connections; opening and
// migrating them is in dbUtilities.ts. It has no runtime imports, so a test
// can close every connection without loading the driver.
import type * as schema from "@romper/shared/db/schema.js";
import type BetterSqlite3 from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as path from "node:path";

/**
 * The handle database operations take. Inside `withDbTransaction` it's the
 * transaction, so an operation that takes it joins the caller's unit of
 * work (`fooTx(db, …)`).
 */
export type RomperDb = BetterSQLite3Database<typeof schema>;

export interface StoreConnection {
  db: RomperDb;
  sqlite: BetterSqlite3.Database;
}

/** Open connections, by the store's resolved `.romperdb` folder */
const connections = new Map<string, StoreConnection>();

/**
 * Close every open connection. Runs at quit, when the local store changes,
 * and in test teardown before temp folders are deleted (Windows can't
 * delete an open database file).
 */
export function closeAllDbConnections(): void {
  for (const dbDir of connections.keys()) {
    closeDbConnection(dbDir);
  }
}

/**
 * Close the connection to the store in `dbDir`, if one is open. Anything
 * that deletes, renames or recreates a database file calls this first.
 */
export function closeDbConnection(dbDir: string): void {
  const key = connectionKey(dbDir);
  const connection = connections.get(key);
  if (!connection) return;
  connections.delete(key);
  try {
    connection.sqlite.close();
  } catch (error) {
    console.warn(
      `[Main] Couldn't close the database in ${key}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** The registry key for a `.romperdb` folder */
export function connectionKey(dbDir: string): string {
  return path.resolve(dbDir);
}

/** The open connection to the store in `dbDir`, if there is one */
export function getOpenDbConnection(
  dbDir: string,
): StoreConnection | undefined {
  const connection = connections.get(connectionKey(dbDir));
  return connection?.sqlite.open ? connection : undefined;
}

/** How many connections are open (for tests) */
export function openDbConnectionCount(): number {
  return connections.size;
}

/** Record a newly opened connection; dbUtilities' `connect` calls this */
export function registerDbConnection(
  dbDir: string,
  connection: StoreConnection,
): void {
  connections.set(connectionKey(dbDir), connection);
}
