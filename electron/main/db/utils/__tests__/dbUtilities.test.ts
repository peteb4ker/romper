import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sqliteInstances: Array<{ close: ReturnType<typeof vi.fn> }> = [];

vi.mock("better-sqlite3", () => ({
  default: vi.fn(function () {
    const instance = {
      close: vi.fn(),
      pragma: vi.fn(),
      prepare: vi.fn(() => ({ all: vi.fn(() => []) })),
    };
    sqliteInstances.push(instance);
    return instance;
  }),
}));

vi.mock("drizzle-orm/better-sqlite3", () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock("drizzle-orm/better-sqlite3/migrator", () => ({
  migrate: vi.fn(),
}));

vi.mock("../dbMigrations.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dbMigrations.js")>()),
  getMigrationsPath: vi.fn(() => "/migrations"),
}));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { getMigrationsPath } from "../dbMigrations.js";
import { createRomperDbFile, openDbConnectionCount } from "../dbUtilities";

describe("createRomperDbFile connection handling", () => {
  let dbDir: string;

  beforeEach(() => {
    sqliteInstances.length = 0;
    vi.mocked(migrate).mockReset();
    vi.mocked(getMigrationsPath).mockReturnValue("/migrations");
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-dbutil-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dbDir, { force: true, recursive: true });
  });

  it("opens nothing when the migrations folder is missing", () => {
    vi.mocked(getMigrationsPath).mockReturnValue(null);

    const result = createRomperDbFile(dbDir);

    expect(result).toEqual({
      error: "Migrations folder not found.",
      success: false,
    });
    expect(sqliteInstances).toHaveLength(0);
    expect(migrate).not.toHaveBeenCalled();
  });

  it("closes the database when a migration throws", () => {
    vi.mocked(migrate).mockImplementation(() => {
      throw new Error("migration exploded");
    });

    const result = createRomperDbFile(dbDir);

    expect(result).toEqual({ error: "migration exploded", success: false });
    expect(sqliteInstances).toHaveLength(1);
    // Left open, the file stays locked on Windows (RE-10 cleanup, teardown)
    expect(sqliteInstances[0].close).toHaveBeenCalledTimes(1);
    // …and isn't kept as the store's connection
    expect(openDbConnectionCount()).toBe(0);
  });
});
