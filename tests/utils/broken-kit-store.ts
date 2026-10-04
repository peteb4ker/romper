/**
 * A local store with deliberately broken kits (#537), for the e2e specs and
 * the manual's screenshots. Built from the standard e2e fixture:
 *
 * - A0 ("Drums"): its snare's file is gone, so it's labelled "File not
 *   found" and skipped at write, but the kit isn't quarantined.
 * - B1 ("Percussion"): its kick's file isn't a WAV any more, so it's
 *   labelled "Can't be read" and the kit is quarantined.
 *
 * Nothing is known about the fixture's files until Romper checks them,
 * which it does when a kit opens.
 */
import fs from "fs-extra";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "./e2e-fixture-extractor";

export const MISSING_FILE_KIT = "A0";
export const UNREADABLE_FILE_KIT = "B1";

export async function createBrokenKitStore(): Promise<E2ETestEnvironment> {
  const env = await extractE2EFixture();
  const store = env.localStorePath;
  await fs.remove(path.join(store, MISSING_FILE_KIT, "2_snare.wav"));
  await fs.writeFile(
    path.join(store, UNREADABLE_FILE_KIT, "1_kick.wav"),
    "not a wav file",
  );

  // Names, so the screenshots read like a real library
  const db = new DatabaseSync(path.join(store, ".romperdb", "romper.sqlite"));
  try {
    const alias = db.prepare("UPDATE kits SET alias = ? WHERE name = ?");
    alias.run("Drums", MISSING_FILE_KIT);
    alias.run("Percussion", UNREADABLE_FILE_KIT);
    const voice = db.prepare(
      "UPDATE voices SET voice_alias = ? WHERE voice_number = ?",
    );
    voice.run("Kick", 1);
    voice.run("Snare", 2);
  } finally {
    db.close();
  }
  return env;
}

export { cleanupE2EFixture as removeBrokenKitStore };
