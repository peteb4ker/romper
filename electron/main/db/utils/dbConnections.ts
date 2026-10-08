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
  /**
   * The database file the connection opened (device and inode), to tell
   * when the file at the store's path is no longer that file (#535)
   */
  file?: { dev: number; ino: number };
  sqlite: BetterSqlite3.Database;
  /** Watches the store's folder for the file being deleted or moved */
  watcher?: { close: () => void };
}

/** Open connections, by the store's resolved `.romperdb` folder */
const connections = new Map<string, StoreConnection>();

/** Told when a store's database file is missing (#535) */
let databaseMissingListener: ((dbDir: string) => void) | null = null;

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
    connection.watcher?.close();
  } catch {
    // Closing the database matters; a watcher that won't close is harmless
  }
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

/**
 * Report that the store in `dbDir` has no database file, so whoever listens
 * (main tells the renderer, which shows the Invalid Local Store dialog) can
 * react. A listener that throws doesn't fail the database operation.
 */
export function reportDatabaseMissing(dbDir: string): void {
  try {
    databaseMissingListener?.(connectionKey(dbDir));
  } catch (error) {
    console.warn(
      "[Main] Couldn't report the missing database:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Set the one listener told when a store's database file is missing, or
 * clear it with null. Setting replaces any earlier listener.
 */
export function setDatabaseMissingListener(
  listener: ((dbDir: string) => void) | null,
): void {
  databaseMissingListener = listener;
}
