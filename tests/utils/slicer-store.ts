/**
 * A local store for the manual's slicer screenshots (#723), built from the
 * standard e2e fixture plus a long sample given on the command line.
 *
 * This is a one-time capture from a sample on the capturing machine, not a
 * committed fixture: the sample is copied into the temporary store (the
 * original is only read) and never goes into the repo. Only the resulting
 * PNGs are committed.
 *
 * Kit A0 ("Slicer"): voice 1 kick, voice 2 snare, and the long sample on
 * voice 3 in slice mode at /16, with a pattern that shows sequential,
 * moved, longer, random and locked slices.
 */
import fs from "fs-extra";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SLICE_TICKS, type SliceStep } from "../../shared/sliceTypes";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "./e2e-fixture-extractor";

export const SLICER_KIT = "A0";
/** Voice row (0-based) that's sliced */
export const SLICE_ROW = 2;

const DIVISION = 16;
const TICKS_PER_SLICE = SLICE_TICKS / DIVISION;

export async function createSlicerStore(
  samplePath: string,
): Promise<E2ETestEnvironment> {
  const env = await extractE2EFixture();
  const store = env.localStorePath;
  const copy = path.join(store, SLICER_KIT, path.basename(samplePath));
  await fs.copyFile(samplePath, copy);

  // Lit steps play their own slice unless set: step 0 is locked, step 6
  // plays slices 3-4, step 10 is random and step 14 plays slice 9
  const sliceSteps = Array.from({ length: 4 }, () =>
    Array.from({ length: 16 }, (): null | SliceStep => null),
  );
  const sliceRow = sliceSteps[SLICE_ROW];
  sliceRow[0] = slice(0, 1, { locked: true });
  sliceRow[6] = slice(2, 2);
  sliceRow[10] = slice(10, 1, { random: true });
  sliceRow[14] = slice(8);
  const pattern = [
    steps([0, 8, 10]),
    steps([4, 12]),
    steps([0, 2, 3, 4, 6, 8, 10, 11, 12, 14]),
    steps([]),
  ];

  const db = new DatabaseSync(path.join(store, ".romperdb", "romper.sqlite"));
  try {
    db.prepare(
      "UPDATE kits SET alias = ?, slicer_division = ?, step_pattern = ?, slice_steps = ? WHERE name = ?",
    ).run(
      "Slicer",
      DIVISION,
      JSON.stringify(pattern),
      JSON.stringify(sliceSteps),
      SLICER_KIT,
    );
    db.prepare(
      "INSERT INTO samples (kit_name, filename, voice_number, slot_number, source_path) VALUES (?, ?, 3, 0, ?)",
    ).run(SLICER_KIT, path.basename(copy), copy);
    db.prepare(
      "UPDATE voices SET slice_enabled = 1 WHERE kit_name = ? AND voice_number = ?",
    ).run(SLICER_KIT, SLICE_ROW + 1);
    const voice = db.prepare(
      "UPDATE voices SET voice_alias = ? WHERE kit_name = ? AND voice_number = ?",
    );
    voice.run("Kick", SLICER_KIT, 1);
    voice.run("Snare", SLICER_KIT, 2);
    voice.run("Pad", SLICER_KIT, 3);
  } finally {
    db.close();
  }
  return env;
}

function slice(
  startSlice: number,
  lengthSlices = 1,
  flags: Partial<Pick<SliceStep, "locked" | "random">> = {},
): SliceStep {
  return {
    length: lengthSlices * TICKS_PER_SLICE,
    locked: flags.locked ?? false,
    random: flags.random ?? false,
    start: startSlice * TICKS_PER_SLICE,
  };
}

function steps(on: number[]): boolean[] {
  return Array.from({ length: 16 }, (_, s) => on.includes(s));
}

export { cleanupE2EFixture as removeSlicerStore };
