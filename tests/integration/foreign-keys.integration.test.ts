/**
 * The database enforces its own links (#901): a voice or sample row for a
 * kit that isn't there, or a kit for a bank that isn't, is refused and
 * nothing is saved. better-sqlite3 is built with foreign keys on;
 * `openDatabase` sets them too, and this pins it, so a driver change can't
 * turn enforcement off unnoticed.
 *
 * Runs on a real store, through the operations the IPC handlers call.
 */
import * as schema from "@romper/shared/db/schema.js";
import { eq } from "drizzle-orm";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addKit,
  updateVoiceSampleMode,
  updateVoiceSliceSettings,
  updateVoiceStereoMode,
  updateVoiceVolume,
} from "../../electron/main/db/romperDbCoreORM.js";
import { getOpenDbConnection } from "../../electron/main/db/utils/dbConnections.js";
import { withDb } from "../../electron/main/db/utils/dbUtilities.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

let work: string;
let dbDir: string;

/** A kit name with no kit row */
const GONE = "B3";
const REFUSED = "FOREIGN KEY constraint failed";

function rowsFor(kitName: string) {
  const rows = withDb(dbDir, (db) => ({
    samples: db
      .select()
      .from(schema.samples)
      .where(eq(schema.samples.kit_name, kitName))
      .all(),
    voices: db
      .select()
      .from(schema.voices)
      .where(eq(schema.voices.kit_name, kitName))
      .all(),
  }));
  expect(rows.success).toBe(true);
  return rows.data;
}

beforeEach(() => {
  work = createTempStore("romper-foreign-keys-");
  dbDir = path.join(work, ".romperdb");
  expect(createStoreDb(dbDir).success).toBe(true);
});

afterEach(() => {
  removeTempStore(work);
});

describe("[Q-02] the database enforces its links (#901)", () => {
  it("has foreign keys on for a store's connection", () => {
    const connection = getOpenDbConnection(dbDir);

    expect(connection?.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  const writes: [string, () => { error?: string; success: boolean }][] = [
    ["level", () => updateVoiceVolume(dbDir, GONE, 2, 70)],
    ["sample mode", () => updateVoiceSampleMode(dbDir, GONE, 2, "random")],
    [
      "slicer settings",
      () => updateVoiceSliceSettings(dbDir, GONE, 2, { enabled: true }),
    ],
    ["stereo link", () => updateVoiceStereoMode(dbDir, GONE, 2, false)],
  ];

  it.each(writes)(
    "refuses a voice's %s for a kit that isn't there, adding no row",
    (_, write) => {
      const result = write();

      expect(result).toEqual({ error: REFUSED, success: false });
      expect(rowsFor(GONE)).toEqual({ samples: [], voices: [] });
    },
  );

  it("refuses a sample row for a kit that isn't there", () => {
    const result = withDb(dbDir, (db) =>
      db
        .insert(schema.samples)
        .values({
          filename: "kick.wav",
          kit_name: GONE,
          slot_number: 0,
          source_path: "/samples/kick.wav",
          voice_number: 1,
        })
        .run(),
    );

    expect(result).toEqual({ error: REFUSED, success: false });
    expect(rowsFor(GONE)).toEqual({ samples: [], voices: [] });
  });

  it("refuses a kit for a bank that isn't there", () => {
    const result = addKit(dbDir, { bank_letter: "?", name: "?0" });

    expect(result).toEqual({ error: REFUSED, success: false });
    expect(
      withDb(dbDir, (db) =>
        db.select().from(schema.kits).where(eq(schema.kits.name, "?0")).all(),
      ).data,
    ).toEqual([]);
  });
});
