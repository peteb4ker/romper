// DB-related IPC handlers for Romper (modular, testable)
import { ipcMain } from "electron";
import * as path from "path";
import Database from "better-sqlite3";

export function registerDbIpcHandlers() {
  ipcMain.handle("create-romper-db", async (_event, dbDir: string) => {
    try {
      const dbPath = path.join(dbDir, "romper.sqlite");
      // Create DB file and open connection
      const db = new Database(dbPath);
      // Create tables if not exist (example schema, adjust as needed)
      db.exec(`
        CREATE TABLE IF NOT EXISTS plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS kits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id INTEGER,
          name TEXT NOT NULL,
          FOREIGN KEY(plan_id) REFERENCES plans(id)
        );
        CREATE TABLE IF NOT EXISTS samples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kit_id INTEGER,
          filename TEXT NOT NULL,
          metadata TEXT,
          FOREIGN KEY(kit_id) REFERENCES kits(id)
        );
      `);
      db.close();
      return { success: true, dbPath };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}
