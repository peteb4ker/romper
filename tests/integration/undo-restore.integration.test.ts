/**
 * Added samples keep their WAV header (RE-89), and undo restores voices
 * as full rows in one transaction (RE-86).
 *
 * Runs the real services on a real store. Fault injection uses a SQLite
 * trigger (RAISE(ABORT)) on the kit's modified flag, which the restore
 * writes last.
 */
import type { Sample } from "@romper/shared/db/schema.js";

import { snapshotVoices } from "@romper/shared/undoTypes.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/nonexistent", isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
}));

import {
  addKit,
  closeAllDbConnections,
  createRomperDbFile,
  getKit,
  getKitSamples,
  updateSampleGain,
  withDbTransaction,
} from "../../electron/main/db/romperDbCoreORM.js";
import { sampleService } from "../../electron/main/services/sampleService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";

let work: string;
let store: string;
let dbDir: string;
let settings: { localStorePath: string };

/** Everything but the row id, which a restore doesn't keep */
function rows(kitName = "A0"): Omit<Sample, "id">[] {
  return (getKitSamples(dbDir, kitName).data ?? [])
    .sort(
      (a, b) =>
        a.voice_number - b.voice_number || a.slot_number - b.slot_number,
    )
    .map(({ id: _id, ...row }) => row);
}

function wav(
  name: string,
  { channels = 1, hz = 220, sampleRate = 44100 } = {},
) {
  const file = path.join(work, "in", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    encodeTestWav(
      Array.from({ length: channels }, () => sine(hz, 0.02, sampleRate)),
      { bitDepth: 24, encoding: "pcm", sampleRate },
    ),
  );
  return file;
}

beforeEach(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), "romper-undo-restore-"));
  store = path.join(work, "store");
  dbDir = path.join(store, ".romperdb");
  expect(createRomperDbFile(dbDir).success).toBe(true);
  settings = { localStorePath: store };
  expect(
    addKit(dbDir, {
      bank_letter: "A",
      editable: true,
      modified_since_sync: false,
      name: "A0",
    }).success,
  ).toBe(true);
});

afterEach(() => {
  // Windows can't delete a database file that's still open
  closeAllDbConnections();
  fs.rmSync(work, { force: true, recursive: true });
});

describe("[UC-19] [Q-02] an added sample keeps its WAV header (RE-89)", () => {
  it("stores the header the add just validated, as a scan would", () => {
    const file = wav("stereo.wav", { channels: 2, sampleRate: 48000 });

    const added = sampleService.addSampleToSlot(settings, "A0", 1, 0, file);

    expect(added.error).toBeUndefined();
    expect(rows()[0]).toMatchObject({
      filename: "stereo.wav",
      wav_bit_depth: 24,
      wav_bitrate: 48000 * 2 * 24,
      wav_channels: 2,
      wav_sample_rate: 48000,
    });
  });
});

describe("[UC-26] [Q-02] undo restores voices in one transaction (RE-86)", () => {
  /** Voice 1 holds a, b, c with distinct gains; voice 2 holds d */
  function seed() {
    for (const [slot, name] of ["a", "b", "c"].entries()) {
      expect(
        sampleService.addSampleToSlot(
          settings,
          "A0",
          1,
          slot,
          wav(`${name}.wav`, { hz: 110 * (slot + 1) }),
        ).success,
      ).toBe(true);
      expect(
        updateSampleGain(dbDir, "A0", 1, slot, -2 * (slot + 1)).success,
      ).toBe(true);
    }
    expect(
      sampleService.addSampleToSlot(settings, "A0", 2, 0, wav("d.wav")).success,
    ).toBe(true);
    withDbTransaction(dbDir, (_db, sqlite) =>
      sqlite.exec("UPDATE kits SET modified_since_sync = 0"),
    );
  }

  const snapshot = (voices: number[]) =>
    snapshotVoices(getKitSamples(dbDir, "A0").data ?? [], voices);

  it("undoing a delete brings the sample back with its gain and header, and the others to their slots", () => {
    seed();
    const before = rows();
    const voicesBefore = snapshot([1]);
    expect(
      sampleService.deleteSampleFromSlot(settings, "A0", 1, 0).success,
    ).toBe(true);
    expect(rows()).not.toEqual(before);

    const restored = sampleService.restoreVoices(settings, "A0", voicesBefore);

    expect(restored).toEqual({ data: undefined, success: true });
    expect(rows()).toEqual(before);
    expect(
      rows()
        .filter((r) => r.voice_number === 1)
        .map((r) => r.gain_db),
    ).toEqual([-2, -4, -6]);
    // The restore is itself an edit since the last write
    expect(getKit(dbDir, "A0").data?.modified_since_sync).toBe(true);
  });

  it("undoing a move puts both voices back and leaves the others alone", () => {
    seed();
    const before = rows();
    const voicesBefore = snapshot([1, 2]);
    expect(
      sampleService.moveSampleInKit(settings, "A0", 1, 1, 2, 0, "insert")
        .success,
    ).toBe(true);

    expect(
      sampleService.restoreVoices(settings, "A0", voicesBefore).success,
    ).toBe(true);

    expect(rows()).toEqual(before);
  });

  it("a failure partway restores nothing", () => {
    seed();
    const voicesBefore = snapshot([1]);
    sampleService.deleteSampleFromSlot(settings, "A0", 1, 0);
    const afterDelete = rows();
    withDbTransaction(dbDir, (_db, sqlite) =>
      sqlite.exec(
        "CREATE TRIGGER no_flag BEFORE UPDATE OF modified_since_sync ON kits BEGIN SELECT RAISE(ABORT, 'injected fault'); END",
      ),
    );

    const restored = sampleService.restoreVoices(settings, "A0", voicesBefore);

    expect(restored.success).toBe(false);
    expect(rows()).toEqual(afterDelete);
  });

  it("refuses a snapshot it can't trust, and changes nothing", () => {
    seed();
    const before = rows();
    const [voice] = snapshot([1]);

    for (const bad of [
      [{ ...voice, voice: 5 }],
      [{ ...voice, samples: [voice.samples[0], voice.samples[0]] }],
      [{ ...voice, samples: [{ ...voice.samples[0], slot_number: 12 }] }],
      [{ ...voice, samples: [{ ...voice.samples[0], gain_db: Number.NaN }] }],
    ]) {
      expect(sampleService.restoreVoices(settings, "A0", bad).success).toBe(
        false,
      );
    }
    expect(sampleService.restoreVoices(settings, "Z9", [voice]).success).toBe(
      false,
    );
    expect(rows()).toEqual(before);
  });
});
