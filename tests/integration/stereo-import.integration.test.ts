import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import {
  addSample,
  getKit,
  markKitAsModified,
  updateVoiceStereoMode,
} from "../../electron/main/db/romperDbCoreORM.js";
import { LocalStoreSetupService } from "../../electron/main/services/localStoreSetupService.js";
import { scanService } from "../../electron/main/services/scanService.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #537: importing a card linked no voice, so the next write mixed the card's
// stereo samples down to mono. Pete's final stereo rules v2: setup and the
// write link a voice automatically when every sample on it is stereo and
// the next voice is free (rule 2); a mono voice is mixed down (rule 1);
// links are never undone (rule 3); a kit that breaks a stereo pair is
// quarantined: not written, its card copy untouched (rule 4); a scan
// changes nothing and reports. Romper's design, unverified on hardware.

/** A short tone, one sine per channel */
function wav(channels: 1 | 2): Buffer {
  const tone = (hz: number) => sine(hz, 0.05, 44100);
  return encodeTestWav(channels === 1 ? [tone(220)] : [tone(220), tone(330)], {
    bitDepth: 16,
    encoding: "pcm",
    sampleRate: 44100,
  });
}

/** Channel count of a WAV file's fmt chunk (canonical 44-byte header) */
const channelsOf = (file: string) => fs.readFileSync(file).readUInt16LE(22);

/** Every file in a folder, by name, with its bytes */
function snapshot(folder: string): Record<string, string> {
  return Object.fromEntries(
    fs
      .readdirSync(folder)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => [
        name,
        fs.readFileSync(path.join(folder, name)).toString("base64"),
      ]),
  );
}

/**
 * The card:
 *
 * - A0: stereo pad on voice 1, voice 2 empty, mono kick on voice 3: rule 2
 *   links voice 1
 * - A1: stereo pad on voice 2, mono hat on voice 3: voice 2 mixed down
 * - A2: stereo pad on voice 4: mixed down
 * - A3: a stereo pad and a mono kick on voice 1: mixed down
 */
const CARD: Record<string, Record<string, 1 | 2>> = {
  A0: { "1 PAD.wav": 2, "3 KICK.wav": 1 },
  A1: { "2 PAD.wav": 2, "3 HAT.wav": 1 },
  A2: { "4 PAD.wav": 2 },
  A3: { "1 KICK.wav": 1, "1 PAD.wav": 2 },
};

describe("[UC-01] [UC-13] [UC-34] [Q-04] Stereo samples from a card stay stereo (#537)", () => {
  let tempDir: string;
  let store: string;
  let dbDir: string;
  let card: string;
  let savedEnvPath: string | undefined;
  const settings = () => ({ localStorePath: store });

  const voice = (kit: string, n: number) =>
    getKit(dbDir, kit).data!.voices!.find((v) => v.voice_number === n)!;
  const write = async () => {
    const result = await syncService.startKitSync(settings(), {
      sdCardPath: card,
    });
    expect(result.success, result.error).toBe(true);
  };
  const cardFile = (kit: string, voiceNumber: number, name: string) => {
    const file = fs
      .readdirSync(path.join(card, kit))
      .find((f) => f.startsWith(`${voiceNumber}`) && f.includes(name));
    expect(file, `${kit} ${name}`).toBeDefined();
    return path.join(card, kit, file!);
  };

  function importCard() {
    const setup = new LocalStoreSetupService();
    expect(setup.createSetupDatabase(dbDir).success).toBe(true);
    return Object.fromEntries(
      Object.keys(CARD).map((kit) => {
        const result = setup.importSetupKit(dbDir, kit);
        expect(result.success, kit).toBe(true);
        return [kit, result.data!];
      }),
    );
  }

  beforeEach(() => {
    savedEnvPath = process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_LOCAL_PATH;
    tempDir = createTempStore("stereo-import-");
    store = path.join(tempDir, "store");
    dbDir = path.join(store, ".romperdb");
    card = path.join(tempDir, "card");
    fs.mkdirSync(card);
    // Setup copies the card's kit folders into the store, then imports them
    for (const [kit, files] of Object.entries(CARD)) {
      fs.mkdirSync(path.join(store, kit), { recursive: true });
      for (const [file, channels] of Object.entries(files)) {
        fs.writeFileSync(path.join(store, kit, file), wav(channels));
      }
    }
  });

  afterEach(() => {
    if (savedEnvPath === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedEnvPath;
    removeTempStore(tempDir);
  });

  it("setup links automatically where rule 2 says, and moves nothing", () => {
    const results = importCard();

    expect(results.A0.stereo?.autoLinks).toEqual([1]);
    expect(voice("A0", 1)).toMatchObject({
      stereo_choice: null,
      stereo_mode: true,
    });
    // Rule 1: the rest are mono voices, mixed down at write
    expect(results.A1.stereo).toMatchObject({
      autoLinks: [],
      mixdowns: [{ reason: "mono_voice", voiceNumber: 2 }],
      quarantine: [],
    });
    expect(results.A2.stereo?.mixdowns).toEqual([
      { reason: "mono_voice", voiceNumber: 4 },
    ]);
    expect(results.A3.stereo?.mixdowns).toEqual([
      { reason: "mono_voice", voiceNumber: 1 },
    ]);
    for (const kit of ["A1", "A2", "A3"]) {
      expect(
        getKit(dbDir, kit).data!.voices!.some((v) => v.stereo_mode),
        kit,
      ).toBe(false);
    }

    // Every file is imported on its own voice, and nothing is to write yet
    for (const [kit, files] of Object.entries(CARD)) {
      const imported = getKit(dbDir, kit).data!;
      expect(imported.modified_since_sync, kit).toBe(false);
      expect(
        (imported.samples ?? []).map((s) => [s.voice_number, s.filename]),
        kit,
      ).toEqual(
        expect.arrayContaining(
          Object.keys(files).map((f) => [Number(f[0]), f]),
        ),
      );
    }
  });

  it("a scan changes nothing about stereo, and reports what the rules will do", () => {
    importCard();
    // A stereo file lands on A2's voice 2, which rule 2 would link with 3
    fs.writeFileSync(path.join(store, "A2", "2 PAD.wav"), wav(2));

    const a2 = scanService.rescanKit(settings(), "A2");
    expect(a2.success).toBe(true);
    expect(a2.data).toMatchObject({
      addedSamples: 1,
      stereo: {
        autoLinks: [2],
        mixdowns: [{ reason: "mono_voice", voiceNumber: 4 }],
        quarantine: [],
      },
    });
    expect(voice("A2", 2).stereo_mode).toBe(false);

    // Unlinked by hand: reported as mixed down, and not linked again
    expect(updateVoiceStereoMode(dbDir, "A0", 1, false).success).toBe(true);
    const a0 = scanService.rescanKit(settings(), "A0");
    expect(a0.data?.stereo).toMatchObject({
      autoLinks: [],
      mixdowns: [{ reason: "mono_voice", voiceNumber: 1 }],
    });
    expect(voice("A0", 1)).toMatchObject({
      stereo_choice: "mono",
      stereo_mode: false,
    });
  });

  it("the write links automatically, keeps linked stereo byte for byte, and mixes mono voices down", async () => {
    importCard();
    fs.writeFileSync(path.join(store, "A2", "2 PAD.wav"), wav(2));
    expect(scanService.rescanKit(settings(), "A2").success).toBe(true);

    const summary = await syncService.generateChangeSummary(settings(), card);
    expect(summary.data?.stereo).toEqual({
      autoLinks: [{ kitName: "A2", voiceNumber: 2 }],
      mixdowns: [
        { kitName: "A1", reason: "mono_voice", voiceNumber: 2 },
        { kitName: "A2", reason: "mono_voice", voiceNumber: 4 },
        { kitName: "A3", reason: "mono_voice", voiceNumber: 1 },
      ],
      quarantined: [],
    });

    await write();

    // Rule 2 at write: linked, and labelled as linked automatically
    expect(voice("A2", 2)).toMatchObject({
      stereo_choice: null,
      stereo_mode: true,
    });
    for (const [kit, voiceNumber, name] of [
      ["A0", 1, "1 PAD.wav"],
      ["A2", 2, "2 PAD.wav"],
    ] as const) {
      expect(fs.readFileSync(cardFile(kit, voiceNumber, "PAD"))).toEqual(
        fs.readFileSync(path.join(store, kit, name)),
      );
    }
    // Rule 1: mono voices are mixed down
    expect(channelsOf(cardFile("A1", 2, "PAD"))).toBe(1);
    expect(channelsOf(cardFile("A2", 4, "PAD"))).toBe(1);
    expect(channelsOf(cardFile("A3", 1, "PAD"))).toBe(1);
  });

  it("a quarantined kit isn't written, and its folder on the card is untouched", async () => {
    importCard();
    await write();
    const before = snapshot(path.join(card, "A0"));

    // A mono sample on A0's pair (#574), and a change to A1 to write
    const kick = path.join(tempDir, "mono kick.wav");
    fs.writeFileSync(kick, wav(1));
    expect(
      addSample(dbDir, {
        filename: "mono kick.wav",
        kit_name: "A0",
        slot_number: 1,
        source_path: kick,
        voice_number: 1,
        wav_channels: 1,
      }).success,
    ).toBe(true);
    // As the kit editor's add does
    expect(markKitAsModified(dbDir, "A0").success).toBe(true);
    const hat = path.join(tempDir, "hat 2.wav");
    fs.writeFileSync(hat, wav(1));
    expect(
      addSample(dbDir, {
        filename: "hat 2.wav",
        kit_name: "A1",
        slot_number: 1,
        source_path: hat,
        voice_number: 3,
        wav_channels: 1,
      }).success,
    ).toBe(true);

    const summary = await syncService.generateChangeSummary(settings(), card);
    expect(summary.data?.stereo.quarantined).toEqual([
      {
        kitName: "A0",
        problems: [
          { filename: "mono kick.wav", kind: "mono_in_pair", voiceNumber: 1 },
        ],
      },
    ]);
    // Nothing of A0's is listed for removal
    expect(summary.data?.removals.filter((r) => r.startsWith("A0"))).toEqual(
      [],
    );

    await write();

    // A0 on the card is exactly as it was; the other kits are written
    expect(snapshot(path.join(card, "A0"))).toEqual(before);
    expect(fs.existsSync(cardFile("A1", 3, "hat 2"))).toBe(true);
    // A0 still needs writing once it's fixed
    expect(getKit(dbDir, "A0").data!.modified_since_sync).toBe(true);

    // Fixed by unlinking: no longer quarantined, so it's written, mixed down
    expect(updateVoiceStereoMode(dbDir, "A0", 1, false).success).toBe(true);
    await write();
    expect(fs.existsSync(cardFile("A0", 1, "mono kick"))).toBe(true);
    expect(channelsOf(cardFile("A0", 1, "PAD"))).toBe(1);
  });

  it("quarantines a kit with a WAV Romper can't read, and keeps its card copy", async () => {
    importCard();
    await write();
    const before = snapshot(path.join(card, "A3"));

    fs.writeFileSync(path.join(store, "A3", "1 PAD.wav"), "not a wav file");
    const summary = await syncService.generateChangeSummary(settings(), card);
    expect(summary.data?.stereo.quarantined).toEqual([
      {
        kitName: "A3",
        problems: [
          { filename: "1 PAD.wav", kind: "unreadable", voiceNumber: 1 },
        ],
      },
    ]);
    // Not a sample to skip: the whole kit waits until it's fixed
    expect(summary.data?.validationErrors).toEqual([]);

    await write();
    expect(snapshot(path.join(card, "A3"))).toEqual(before);
  });
});
