import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DB_FILENAME,
  getMigrationsPath,
  PRE_UPGRADE_BACKUP_SUFFIX,
  repairMigrationHistory,
} from "../dbMigrations.js";
import {
  clearMigrationCache,
  closeAllDbConnections,
  createRomperDbFile,
  ensureDatabaseMigrations,
} from "../dbUtilities.js";

// RE-33: upgrading an older library ran the 0008/0009 history repair's
// ALTER statements outside a transaction, then Drizzle's migrations in a
// transaction of their own, so an interruption could leave a library half
// upgraded. These tests build a library at every schema version a user could
// have, by replaying the historical migrations, and upgrade it.

const MIGRATIONS = path.resolve(__dirname, "../../migrations");

interface JournalEntry {
  breakpoints: boolean;
  idx: number;
  tag: string;
  version: string;
  when: number;
}

const journal = JSON.parse(
  fs.readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf8"),
) as { dialect: string; entries: JournalEntry[]; version: string };

/**
 * 0008_ordinary_mastermind, as released in c556b95a and deleted in 24f89f4.
 * Libraries that applied it are what the history repair exists for.
 */
const LEGACY_0008: { entry: JournalEntry; sql: string } = {
  entry: {
    breakpoints: true,
    idx: 8,
    tag: "0008_ordinary_mastermind",
    version: "6",
    when: 1755833824990,
  },
  sql: "ALTER TABLE `samples` ADD `wav_bit_depth` integer;--> statement-breakpoint\nALTER TABLE `samples` ADD `wav_channels` integer;",
};

const hashOf = (tag: string) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(MIGRATIONS, `${tag}.sql`)).toString())
    .digest("hex");

/** Each version a library could be at: the tags it has applied, in order */
function historicalVersions(): { name: string; tags: string[] }[] {
  const tags = journal.entries.map((e) => e.tag);
  const upTo = (i: number) => tags.slice(0, i + 1);
  const versions = tags.map((tag, i) => ({ name: tag, tags: upTo(i) }));
  const before0009 = tags.indexOf("0009_purple_zaladane");
  versions.splice(before0009, 0, {
    name: `${LEGACY_0008.entry.tag} (deleted)`,
    tags: [...upTo(before0009 - 1), LEGACY_0008.entry.tag],
  });
  return versions;
}

let tempDir: string;

/** Make recording one migration fail, as a crash at that point would */
function failWhenRecording(dbDir: string, tag: string) {
  withLibrary(dbDir, (sqlite) =>
    sqlite.exec(`
      CREATE TRIGGER simulated_failure BEFORE INSERT ON __drizzle_migrations
      WHEN NEW.hash = '${hashOf(tag)}'
      BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
    `),
  );
}

function historyOf(dbDir: string): { created_at: number; hash: string }[] {
  const sqlite = new BetterSqlite3(path.join(dbDir, DB_FILENAME), {
    readonly: true,
  });
  try {
    return sqlite
      .prepare(
        "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, hash",
      )
      .all() as { created_at: number; hash: string }[];
  } finally {
    sqlite.close();
  }
}

/**
 * A library at a historical version, made the way that release made it,
 * holding one kit with a named voice and a sample
 */
function libraryAt(tags: string[]): string {
  const dbDir = fs.mkdtempSync(path.join(tempDir, "library-"));
  const sqlite = new BetterSqlite3(path.join(dbDir, DB_FILENAME));
  try {
    const firstTag = tags.slice(0, 1);
    migrate(drizzle(sqlite), {
      migrationsFolder: migrationsFolderFor(firstTag),
    });
    // Columns every version has, so the same rows fit them all
    sqlite.exec(`
      INSERT INTO kits (name, alias) VALUES ('A0', 'Drums');
      INSERT INTO voices (kit_name, voice_number, voice_alias)
        VALUES ('A0', 1, 'Kick'), ('A0', 2, NULL), ('A0', 3, NULL), ('A0', 4, NULL);
      INSERT INTO samples (kit_name, filename, voice_number, slot_number, source_path)
        VALUES ('A0', 'kick.wav', 1, 0, '/samples/kick.wav');
    `);
    migrate(drizzle(sqlite), { migrationsFolder: migrationsFolderFor(tags) });
  } finally {
    sqlite.close();
  }
  return dbDir;
}

/** A migrations folder holding just these migrations, as a release shipped */
function migrationsFolderFor(tags: string[]): string {
  const folder = fs.mkdtempSync(path.join(tempDir, "migrations-"));
  fs.mkdirSync(path.join(folder, "meta"));
  const entries = tags.map((tag, idx) => {
    if (tag === LEGACY_0008.entry.tag) {
      fs.writeFileSync(path.join(folder, `${tag}.sql`), LEGACY_0008.sql);
      return { ...LEGACY_0008.entry, idx };
    }
    fs.copyFileSync(
      path.join(MIGRATIONS, `${tag}.sql`),
      path.join(folder, `${tag}.sql`),
    );
    return { ...journal.entries.find((e) => e.tag === tag)!, idx };
  });
  fs.writeFileSync(
    path.join(folder, "meta", "_journal.json"),
    JSON.stringify({ ...journal, entries }),
  );
  return folder;
}

/** Tables, columns and indexes, comparable between two databases */
function schemaOf(dbDir: string) {
  const sqlite = new BetterSqlite3(path.join(dbDir, DB_FILENAME), {
    readonly: true,
  });
  try {
    const tables = (
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name",
        )
        .all() as { name: string }[]
    ).map((t) => t.name);
    return Object.fromEntries(
      tables.map((table) => [
        table,
        {
          columns: sqlite.prepare(`PRAGMA table_info(${table})`).all(),
          indexes: (
            sqlite.prepare(`PRAGMA index_list(${table})`).all() as {
              name: string;
              unique: number;
            }[]
          )
            .map((index) => ({
              columns: (
                sqlite.prepare(`PRAGMA index_info(${index.name})`).all() as {
                  name: string;
                }[]
              ).map((c) => c.name),
              name: index.name,
              unique: index.unique,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        },
      ]),
    );
  } finally {
    sqlite.close();
  }
}

function stopFailing(dbDir: string) {
  withLibrary(dbDir, (sqlite) => sqlite.exec("DROP TRIGGER simulated_failure"));
}

function upgrade(dbDir: string) {
  clearMigrationCache();
  return ensureDatabaseMigrations(dbDir);
}

function withLibrary<T>(
  dbDir: string,
  fn: (sqlite: BetterSqlite3.Database) => T,
) {
  const sqlite = new BetterSqlite3(path.join(dbDir, DB_FILENAME));
  try {
    return fn(sqlite);
  } finally {
    sqlite.close();
  }
}

const CURRENT = journal.entries.map((e) => e.tag);
const LEGACY = historicalVersions().find((v) =>
  v.tags.includes(LEGACY_0008.entry.tag),
)!.tags;

describe("[Q-02] Upgrading a library is all or nothing (RE-33)", () => {
  let currentSchema: ReturnType<typeof schemaOf>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-upgrade-"));
    currentSchema = schemaOf(libraryAt(CURRENT));
  });

  afterEach(() => {
    // Windows can't delete a database file that's still open
    closeAllDbConnections();
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("uses the migrations that ship with the code", () => {
    expect(getMigrationsPath()).toBe(MIGRATIONS);
  });

  describe.each(historicalVersions())("from $name", ({ tags }) => {
    it("upgrades to the current schema and keeps the library's kits", () => {
      const dbDir = libraryAt(tags);

      expect(upgrade(dbDir)).toEqual({ data: true, success: true });

      expect(schemaOf(dbDir)).toEqual(currentSchema);
      const recorded = new Set(historyOf(dbDir).map((m) => m.hash));
      for (const tag of CURRENT) expect(recorded.has(hashOf(tag))).toBe(true);
      withLibrary(dbDir, (sqlite) => {
        expect(
          sqlite.prepare("SELECT name, alias, bank_letter FROM kits").all(),
        ).toEqual([{ alias: "Drums", bank_letter: "A", name: "A0" }]);
        expect(
          sqlite
            .prepare(
              "SELECT voice_number, voice_alias, stereo_mode FROM voices ORDER BY voice_number",
            )
            .all(),
        ).toEqual([
          { stereo_mode: 0, voice_alias: "Kick", voice_number: 1 },
          { stereo_mode: 0, voice_alias: null, voice_number: 2 },
          { stereo_mode: 0, voice_alias: null, voice_number: 3 },
          { stereo_mode: 0, voice_alias: null, voice_number: 4 },
        ]);
        expect(
          sqlite.prepare("SELECT filename, gain_db FROM samples").all(),
        ).toEqual([{ filename: "kick.wav", gain_db: 0 }]);
      });
    });

    it("changes nothing when upgraded again", () => {
      const dbDir = libraryAt(tags);
      upgrade(dbDir);
      const history = historyOf(dbDir);

      expect(upgrade(dbDir).success).toBe(true);

      expect(historyOf(dbDir)).toEqual(history);
      expect(schemaOf(dbDir)).toEqual(currentSchema);
    });
  });

  describe("an upgrade that fails part way", () => {
    it("leaves a library as it was when the history repair fails after adding its columns", () => {
      const dbDir = libraryAt(LEGACY);
      const before = { history: historyOf(dbDir), schema: schemaOf(dbDir) };
      failWhenRecording(dbDir, "0009_purple_zaladane");

      const result = upgrade(dbDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain("simulated failure");
      expect(schemaOf(dbDir)).toEqual(before.schema);
      expect(historyOf(dbDir)).toEqual(before.history);

      // The next launch upgrades it completely
      stopFailing(dbDir);
      expect(upgrade(dbDir).success).toBe(true);
      expect(schemaOf(dbDir)).toEqual(currentSchema);
    });

    it("leaves a library as it was when a later migration fails, repair included", () => {
      const dbDir = libraryAt(LEGACY);
      const before = { history: historyOf(dbDir), schema: schemaOf(dbDir) };
      failWhenRecording(dbDir, "0011_military_mesmero");

      expect(upgrade(dbDir).success).toBe(false);

      expect(schemaOf(dbDir)).toEqual(before.schema);
      expect(historyOf(dbDir)).toEqual(before.history);

      stopFailing(dbDir);
      expect(upgrade(dbDir).success).toBe(true);
      expect(schemaOf(dbDir)).toEqual(currentSchema);
    });

    it("leaves a library as it was when the last migration fails", () => {
      const dbDir = libraryAt(CURRENT.slice(0, -1));
      const before = { history: historyOf(dbDir), schema: schemaOf(dbDir) };
      failWhenRecording(dbDir, CURRENT.at(-1)!);

      expect(upgrade(dbDir).success).toBe(false);

      expect(schemaOf(dbDir)).toEqual(before.schema);
      expect(historyOf(dbDir)).toEqual(before.history);
    });
  });

  describe("the history repair on its own", () => {
    it("adds 0009's missing column and records 0009, once", () => {
      const dbDir = libraryAt(LEGACY);

      withLibrary(dbDir, (sqlite) => {
        repairMigrationHistory(sqlite);
        const afterFirst = historyOf(dbDir).length;
        repairMigrationHistory(sqlite);

        expect(historyOf(dbDir)).toHaveLength(afterFirst);
        expect(
          historyOf(dbDir).some(
            (m) => m.hash === hashOf("0009_purple_zaladane"),
          ),
        ).toBe(true);
        expect(
          (
            sqlite.prepare("PRAGMA table_info(voices)").all() as {
              name: string;
            }[]
          ).filter((c) => c.name === "stereo_mode"),
        ).toHaveLength(1);
      });
    });

    it("rolls its columns back when recording 0009 fails", () => {
      const dbDir = libraryAt(LEGACY);
      const before = schemaOf(dbDir);
      failWhenRecording(dbDir, "0009_purple_zaladane");

      withLibrary(dbDir, (sqlite) => {
        expect(() => repairMigrationHistory(sqlite)).toThrow(
          "simulated failure",
        );
      });

      expect(schemaOf(dbDir)).toEqual(before);
    });
  });

  describe("the copy saved before an upgrade", () => {
    const backupOf = (dbDir: string) =>
      path.join(dbDir, DB_FILENAME + PRE_UPGRADE_BACKUP_SUFFIX);

    it("holds the library as it was before the upgrade", () => {
      const dbDir = libraryAt(LEGACY);
      const before = schemaOf(dbDir);

      expect(upgrade(dbDir).success).toBe(true);

      const backupDir = fs.mkdtempSync(path.join(tempDir, "restored-"));
      fs.copyFileSync(backupOf(dbDir), path.join(backupDir, DB_FILENAME));
      expect(schemaOf(backupDir)).toEqual(before);
      expect(fs.existsSync(`${backupOf(dbDir)}.partial`)).toBe(false);
    });

    it("isn't made for a new store", () => {
      const dbDir = path.join(tempDir, "new-store");

      expect(createRomperDbFile(dbDir).success).toBe(true);

      expect(schemaOf(dbDir)).toEqual(currentSchema);
      expect(fs.existsSync(backupOf(dbDir))).toBe(false);
    });

    it("isn't made when there's nothing to upgrade", () => {
      const dbDir = libraryAt(CURRENT);

      expect(upgrade(dbDir).success).toBe(true);

      expect(fs.existsSync(backupOf(dbDir))).toBe(false);
    });

    it("stops the upgrade when it can't be saved", () => {
      const dbDir = libraryAt(LEGACY);
      const before = { history: historyOf(dbDir), schema: schemaOf(dbDir) };
      // A folder in the copy's place makes saving it fail on every platform
      fs.mkdirSync(path.join(backupOf(dbDir), "occupied"), { recursive: true });

      const result = upgrade(dbDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Couldn't save a copy of the database");
      expect(schemaOf(dbDir)).toEqual(before.schema);
      expect(historyOf(dbDir)).toEqual(before.history);
      expect(fs.existsSync(`${backupOf(dbDir)}.partial`)).toBe(false);
    });
  });
});
