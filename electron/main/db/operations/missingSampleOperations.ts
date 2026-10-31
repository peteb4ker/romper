import type { Sample } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import {
  snapshotVoices,
  type VoiceSnapshot,
} from "@romper/shared/undoTypes.js";
import { and, eq, inArray } from "drizzle-orm";

import type { RomperDb } from "../utils/dbUtilities.js";

import { requireKitForMissingSampleRemovalTx } from "./kitEditableGuard.js";
import { flagKitModified } from "./kitSyncOperations.js";
import { restoreVoicesTx } from "./sampleCrudOperations.js";
import { reindexVoiceTx } from "./sampleManagementOps.js";

const { samples } = schema;

/** A row whose file main found still missing, as it was when checked */
export interface ConfirmedMissingSample {
  id: number;
  source_path: string;
}

/**
 * Undo a removal of missing samples: put the voices back as
 * `removeMissingSamplesTx` returned them, on the caller's transaction. It
 * is allowed on a read-only kit (D5) only because it can do nothing but
 * that: each voice must hold exactly the snapshot's other rows, in the
 * same order with the same file, name and gain, and every row it adds back
 * must be one recorded missing. Anything else means the kit changed since,
 * and it throws. Returns how many rows it put back.
 */
export function putBackMissingSamplesTx(
  db: RomperDb,
  kitName: string,
  voices: VoiceSnapshot[],
): number {
  requireKitForMissingSampleRemovalTx(db, kitName);
  const seen = new Set<number>();
  let putBack = 0;
  for (const voice of voices) {
    if (seen.has(voice?.voice)) {
      throw new Error(`Voice ${voice.voice} is listed twice`);
    }
    seen.add(voice?.voice);
    putBack += rowsPutBack(db, kitName, voice);
  }
  restoreVoicesTx(db, kitName, voices);
  return putBack;
}

/**
 * A kit's rows recorded missing: the ones `removeMissingSamplesTx` may
 * remove once their files are checked again (#822)
 */
export function readMissingSamplesTx(db: RomperDb, kitName: string): Sample[] {
  requireKitForMissingSampleRemovalTx(db, kitName);
  return db
    .select()
    .from(samples)
    .where(
      and(eq(samples.kit_name, kitName), eq(samples.source_status, "missing")),
    )
    .all();
}

/**
 * Remove the rows whose files were found still missing, close the gaps in
 * their voices and flag the kit modified, on the caller's transaction
 * (#822, stage 5 of docs/developer/store-check.md). Never touches a file.
 *
 * A row is removed only if it still points at the file that was checked
 * and is still recorded missing, so an edit, a scan or a check that
 * changed it since wins. Allowed on a read-only kit (D5,
 * `requireKitForMissingSampleRemovalTx`). Returns how many rows went and
 * the voices they were in as they were before, for undo.
 */
export function removeMissingSamplesTx(
  db: RomperDb,
  kitName: string,
  confirmed: ConfirmedMissingSample[],
): { samples: number; voicesBefore: VoiceSnapshot[] } {
  requireKitForMissingSampleRemovalTx(db, kitName);
  const checkedPath = new Map(
    confirmed.map((row) => [row.id, row.source_path]),
  );
  const rows = db
    .select()
    .from(samples)
    .where(eq(samples.kit_name, kitName))
    .all();
  const removed = rows.filter(
    (row) =>
      row.source_status === "missing" &&
      checkedPath.get(row.id) === row.source_path,
  );
  if (removed.length === 0) return { samples: 0, voicesBefore: [] };

  const voices = new Set(removed.map((row) => row.voice_number));
  const voicesBefore = snapshotVoices(rows, voices);
  db.delete(samples)
    .where(
      inArray(
        samples.id,
        removed.map((row) => row.id),
      ),
    )
    .run();
  for (const voice of voices) reindexVoiceTx(db, kitName, voice);
  flagKitModified(db, kitName);
  return { samples: removed.length, voicesBefore };
}

/**
 * How many rows putting `voice` back would add, or a throw if the voice
 * isn't as the removal left it
 */
function rowsPutBack(
  db: RomperDb,
  kitName: string,
  { samples: snapshot, voice }: VoiceSnapshot,
): number {
  if (!Array.isArray(snapshot)) {
    throw new Error(`Invalid samples for voice ${voice}`);
  }
  const current = db
    .select()
    .from(samples)
    .where(and(eq(samples.kit_name, kitName), eq(samples.voice_number, voice)))
    .orderBy(samples.slot_number)
    .all();
  const before = [...snapshot].sort((a, b) => a.slot_number - b.slot_number);
  const kept = new Set(current.map((row) => row.source_path));
  const stays = before.filter((row) => kept.has(row.source_path));
  const added = before.filter((row) => !kept.has(row.source_path));
  const unchanged =
    stays.length === current.length &&
    stays.every(
      (row, i) =>
        row.source_path === current[i].source_path &&
        row.filename === current[i].filename &&
        row.gain_db === current[i].gain_db,
    );
  if (!unchanged || added.some((row) => row.source_status !== "missing")) {
    throw new Error(
      `Voice ${voice} of kit ${kitName} changed since its missing samples were removed`,
    );
  }
  return added.length;
}
