import { samples } from "@romper/shared/db/schema.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createRomperDbFile,
  withDbTransaction,
} from "../../utils/dbUtilities.js";
import { addKit } from "../kitCrudOperations.js";
import { isSourcePathReferenced } from "../sampleSourceQueries.js";

describe("[Q-01] [Q-03] isSourcePathReferenced (RE-85)", () => {
  let tempDir: string;
  let dbDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-source-refs-"));
    dbDir = join(tempDir, ".romperdb");
    createRomperDbFile(dbDir);
    addKit(dbDir, { bank_letter: "A", name: "A0" });
    withDbTransaction(dbDir, (db) =>
      db
        .insert(samples)
        .values(
          ["/library/kick.wav", "/library/snare.wav"].map((source_path, i) => ({
            filename: `${i}.wav`,
            kit_name: "A0",
            slot_number: i,
            source_path,
            voice_number: 1,
          })),
        )
        .run(),
    );
  });

  afterEach(() => {
    // Windows can hold a just-closed database file for a moment
    rmSync(tempDir, { force: true, maxRetries: 5, recursive: true });
  });

  it("finds a path a sample references", () => {
    expect(isSourcePathReferenced(dbDir, ["/library/snare.wav"])).toEqual({
      data: true,
      success: true,
    });
  });

  it("finds a match among several forms of the path", () => {
    expect(
      isSourcePathReferenced(dbDir, [
        "/library/x/../kick.wav",
        "/library/kick.wav",
      ]).data,
    ).toBe(true);
  });

  it("doesn't find a path no sample references", () => {
    expect(isSourcePathReferenced(dbDir, ["/etc/passwd"]).data).toBe(false);
    expect(isSourcePathReferenced(dbDir, ["/library"]).data).toBe(false);
  });

  it("answers no for no paths without opening the database", () => {
    expect(isSourcePathReferenced(join(tempDir, "missing"), [])).toEqual({
      data: false,
      success: true,
    });
  });
});
