// This script runs in Electron's Node.js context to verify database contents
// It's called from the E2E test via Electron's main process

import Database from "better-sqlite3";
import { existsSync } from "fs";

export interface DatabaseVerificationResult {
  success: boolean;
  error?: string;
  kits?: number;
  samples?: number;
  tables?: string[];
}

export function verifyDatabase(dbPath: string): DatabaseVerificationResult {
  try {
    if (!existsSync(dbPath)) {
      return {
        success: false,
        error: `Database file does not exist at ${dbPath}`,
      };
    }

    const db = new Database(dbPath, { readonly: true });

    // Get list of tables
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `,
      )
      .all()
      .map((row: any) => row.name);

    // Count kits
    const kitCount = db.prepare("SELECT COUNT(*) as count FROM kits").get() as {
      count: number;
    };

    // Count samples
    const sampleCount = db
      .prepare("SELECT COUNT(*) as count FROM samples")
      .get() as { count: number };

    db.close();

    return {
      success: true,
      tables,
      kits: kitCount.count,
      samples: sampleCount.count,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
