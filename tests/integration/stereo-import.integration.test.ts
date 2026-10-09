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
  getKits,
  markKitAsModified,
  updateSampleMetadata,
  updateVoiceStereoMode,
  withDbTransaction,
} from "../../electron/main/db/romperDbCoreORM.js";
import { LocalStoreSetupService } from "../../electron/main/services/localStoreSetupService.js";
import { scanService } from "../../electron/main/services/scanService.js";
import { syncFileOperationsService } from "../../electron/main/services/syncFileOperations.js";
import { syncProgressManager } from "../../electron/main/services/syncProgressManager.js";
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
    vi.restoreAllMocks();
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

  // Automatic links are atomic with the write (#537): recorded only once
  // the write completes, so a cancelled or failed write leaves none
  describe("[Q-02] automatic links and an incomplete write", () => {
    /** A2 gains a stereo file on voice 2, which the write would link */
    function withAutoLink() {
      importCard();
      fs.writeFileSync(path.join(store, "A2", "2 PAD.wav"), wav(2));
      expect(scanService.rescanKit(settings(), "A2").success).toBe(true);
      expect(voice("A2", 2).stereo_mode).toBe(false);
    }

    it("a cancelled write leaves no automatic link", async () => {
      withAutoLink();
      const emit =
        syncProgressManager.emitFileCompletionProgress.bind(
          syncProgressManager,
        );
      vi.spyOn(
        syncProgressManager,
        "emitFileCompletionProgress",
      ).mockImplementation((fileOp) => {
        emit(fileOp);
        syncService.cancelSync();
      });

      const result = await syncService.startKitSync(settings(), {
        sdCardPath: card,
      });

      expect(result.data?.cancelled).toBe(true);
      expect(voice("A2", 2)).toMatchObject({
        stereo_choice: null,
        stereo_mode: false,
      });
    });

    it("a failed write leaves no automatic link", async () => {
      withAutoLink();
      vi.spyOn(syncFileOperationsService, "processAllFiles").mockRejectedValue(
        new Error("ENOSPC: no space left on device"),
      );

      const result = await syncService.startKitSync(settings(), {
        sdCardPath: card,
      });

      expect(result.success).toBe(false);
      expect(voice("A2", 2)).toMatchObject({
        stereo_choice: null,
        stereo_mode: false,
      });
    });

    it("a write that fails while recording itself rolls its automatic links back", async () => {
      withAutoLink();
      // The links are recorded first, then the synced flags, in one
      // transaction: failing the flags must take the links with them
      expect(markKitAsModified(dbDir, "A2").success).toBe(true);
      withDbTransaction(dbDir, (_db, sqlite) =>
        sqlite.exec(`
          CREATE TRIGGER fail_marking_synced
          BEFORE UPDATE OF modified_since_sync ON kits
          WHEN NEW.modified_since_sync = 0
          BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
        `),
      );

      const result = await syncService.startKitSync(settings(), {
        sdCardPath: card,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("simulated failure");
      expect(voice("A2", 2)).toMatchObject({
        stereo_choice: null,
        stereo_mode: false,
      });
    });

    it("a completed write records the link", async () => {
      withAutoLink();
      await write();
      expect(voice("A2", 2).stereo_mode).toBe(true);
    });
  });

  // #537: missing and unreadable files show in the kit editor, recorded
  // when Romper reads them and checked once per kit open when unknown
  describe("[UC-08] [UC-13] [UC-19] what Romper knows about each sample's file", () => {
    const status = (kit: string, filename: string) =>
      getKit(dbDir, kit).data!.samples!.find((s) => s.filename === filename)
        ?.source_status;
    // A whole second, which a file keeps exactly when it is set again; a
    // modification time read back from disk can differ in its last digits
    const PINNED = new Date("2024-01-01T00:00:00Z");
    const pin = (file: string, when = PINNED) =>
      fs.utimesSync(file, when, when);
    /** Give every file in the store the pinned time, before it's imported */
    const pinStore = () => {
      for (const [kit, files] of Object.entries(CARD)) {
        for (const file of Object.keys(files)) {
          pin(path.join(store, kit, file));
        }
      }
    };

    it("setup records every file it read as readable", () => {
      importCard();
      for (const [kit, files] of Object.entries(CARD)) {
        for (const file of Object.keys(files)) {
          expect(status(kit, file), `${kit} ${file}`).toBe("readable");
        }
      }
    });

    it("the kit-open check records missing, unreadable and readable files, in one batch", async () => {
      importCard();
      const kick = path.join(tempDir, "kick.wav");
      fs.writeFileSync(kick, wav(1));
      // Added outside the app's add path: nothing known about them yet
      for (const [filename, source, slot] of [
        ["kick.wav", kick, 1],
        ["gone.wav", path.join(tempDir, "gone.wav"), 2],
        ["bad.wav", path.join(tempDir, "bad.wav"), 3],
      ] as const) {
        expect(
          addSample(dbDir, {
            filename,
            kit_name: "A1",
            slot_number: slot,
            source_path: source,
            voice_number: 3,
          }).success,
        ).toBe(true);
      }
      fs.writeFileSync(path.join(tempDir, "bad.wav"), "not a wav file");

      const checked = await scanService.checkKitSampleFiles(settings(), "A1");
      // Every sample is checked; only the three new ones change
      const total = getKit(dbDir, "A1").data!.samples!.length;

      expect(checked.data).toEqual({ changed: 3, checked: total });
      expect(status("A1", "kick.wav")).toBe("readable");
      expect(
        getKit(dbDir, "A1").data!.samples!.find(
          (s) => s.filename === "kick.wav",
        )?.wav_channels,
      ).toBe(1);
      expect(status("A1", "gone.wav")).toBe("missing");
      expect(status("A1", "bad.wav")).toBe("unreadable");
      // An unreadable WAV quarantines the kit; a missing file doesn't
      expect(getKit(dbDir, "A1").data!.quarantined).toBe(true);

      // Put back and fixed: the next open's check sees it
      fs.writeFileSync(path.join(tempDir, "gone.wav"), wav(1));
      fs.writeFileSync(path.join(tempDir, "bad.wav"), wav(1));
      expect(
        (await scanService.checkKitSampleFiles(settings(), "A1")).data,
      ).toEqual({ changed: 2, checked: total });
      expect(getKit(dbDir, "A1").data!.quarantined).toBe(false);
      // Nothing changed since
      expect(
        (await scanService.checkKitSampleFiles(settings(), "A1")).data,
      ).toEqual({ changed: 0, checked: total });
    });

    it("the kit-open check finds a known-readable file that's gone, without re-reading the rest", async () => {
      pinStore();
      importCard();
      expect(status("A1", "3 HAT.wav")).toBe("readable");
      expect(status("A1", "2 PAD.wav")).toBe("readable");
      fs.rmSync(path.join(store, "A1", "3 HAT.wav"));
      // Still there and unchanged (same size and modification time), so
      // only its existence is checked, not its header (#793)
      const padFile = path.join(store, "A1", "2 PAD.wav");
      fs.writeFileSync(padFile, Buffer.alloc(fs.statSync(padFile).size, 1));
      pin(padFile);

      const checked = await scanService.checkKitSampleFiles(settings(), "A1");

      expect(checked.data?.changed).toBe(1);
      expect(status("A1", "3 HAT.wav")).toBe("missing");
      expect(status("A1", "2 PAD.wav")).toBe("readable");
      expect(getKit(dbDir, "A1").data!.quarantined).toBe(false);
    });

    it("[UC-34] the kit-open check reads a file once more when its format tag isn't stored (#576)", async () => {
      importCard();
      const pad = () =>
        getKit(dbDir, "A1").data!.samples!.find(
          (s) => s.filename === "2 PAD.wav",
        )!;
      expect(pad().wav_format_tag).toBe(1);
      // As a library from before #576 has it
      updateSampleMetadata(dbDir, pad().id, { wav_format_tag: null });

      const checked = await scanService.checkKitSampleFiles(settings(), "A1");

      expect(checked.data?.changed).toBe(1);
      expect(pad().wav_format_tag).toBe(1);
      expect(
        (await scanService.checkKitSampleFiles(settings(), "A1")).data?.changed,
      ).toBe(0);
    });

    describe("[UC-34] [Q-08] a file changed on disk shows its new format (#793)", () => {
      const padFile = () => path.join(store, "A1", "2 PAD.wav");
      const pad = () =>
        getKit(dbDir, "A1").data!.samples!.find(
          (s) => s.filename === "2 PAD.wav",
        )!;
      /** A mono 32-bit float file: the same size as the stereo 16-bit pad */
      const floatPad = (hz = 220) =>
        encodeTestWav([sine(hz, 0.05, 44100)], {
          bitDepth: 32,
          encoding: "float",
          sampleRate: 44100,
        });
      const open = () => scanService.checkKitSampleFiles(settings(), "A1");

      it("the setup import stores each file's size and modification time", () => {
        importCard();

        const stat = fs.statSync(padFile());
        expect(pad()).toMatchObject({
          source_mtime_ms: Math.floor(stat.mtimeMs),
          source_size: stat.size,
        });
      });

      it("a file replaced on disk updates its format at the next kit open", async () => {
        importCard();
        expect(pad()).toMatchObject({ wav_channels: 2, wav_format_tag: 1 });
        // Longer, so the size differs
        fs.writeFileSync(
          padFile(),
          encodeTestWav([sine(220, 0.1, 48000)], {
            bitDepth: 24,
            encoding: "pcm",
            sampleRate: 48000,
          }),
        );

        const checked = await open();

        expect(checked.data?.changed).toBe(1);
        expect(pad()).toMatchObject({
          source_size: fs.statSync(padFile()).size,
          source_status: "readable",
          wav_bit_depth: 24,
          wav_channels: 1,
          wav_format_tag: 1,
          wav_sample_rate: 48000,
        });
      });

      it("a file replaced by one of the same size is seen by its modification time", async () => {
        pinStore();
        importCard();
        const storedSize = fs.statSync(padFile()).size;
        fs.writeFileSync(padFile(), floatPad());
        expect(fs.statSync(padFile()).size).toBe(storedSize);
        pin(padFile(), new Date(PINNED.getTime() + 60_000));

        expect((await open()).data?.changed).toBe(1);

        expect(pad()).toMatchObject({
          wav_bit_depth: 32,
          wav_channels: 1,
          wav_format_tag: 3,
        });
      });

      it("an unchanged file isn't read again, and a changed one only once", async () => {
        pinStore();
        importCard();
        // Not a WAV, but the same size and modification time as before: if
        // the check read it, the sample would turn unreadable
        fs.writeFileSync(
          padFile(),
          Buffer.alloc(fs.statSync(padFile()).size, 1),
        );
        pin(padFile());

        expect((await open()).data?.changed).toBe(0);
        expect(pad()).toMatchObject({
          source_status: "readable",
          wav_channels: 2,
        });

        fs.writeFileSync(padFile(), floatPad());
        pin(padFile(), new Date(PINNED.getTime() + 60_000));
        expect((await open()).data?.changed).toBe(1);
        expect(pad().wav_format_tag).toBe(3);
        expect((await open()).data?.changed).toBe(0);
      });

      it("a sample from before the size and time were stored is read once, then not again", async () => {
        importCard();
        withDbTransaction(dbDir, (_db, sqlite) =>
          sqlite.exec(
            "UPDATE samples SET source_size = NULL, source_mtime_ms = NULL",
          ),
        );
        const total = getKit(dbDir, "A1").data!.samples!.length;
        expect(pad().source_size).toBeNull();

        expect((await open()).data).toEqual({ changed: total, checked: total });

        expect(pad().source_size).toBe(fs.statSync(padFile()).size);
        expect((await open()).data).toEqual({ changed: 0, checked: total });
      });

      it("a scan refreshes a file changed on disk", () => {
        pinStore();
        importCard();
        const later = new Date(PINNED.getTime() + 60_000);
        fs.writeFileSync(padFile(), floatPad());
        pin(padFile(), later);

        expect(scanService.rescanKit(settings(), "A1").success).toBe(true);

        expect(pad()).toMatchObject({
          source_mtime_ms: later.getTime(),
          wav_bit_depth: 32,
          wav_channels: 1,
          wav_format_tag: 3,
        });
      });

      it("a scan leaves an unchanged file alone", () => {
        pinStore();
        importCard();
        fs.writeFileSync(
          padFile(),
          Buffer.alloc(fs.statSync(padFile()).size, 1),
        );
        pin(padFile());

        expect(scanService.rescanKit(settings(), "A1").success).toBe(true);

        expect(pad()).toMatchObject({
          source_status: "readable",
          wav_channels: 2,
        });
      });
    });

    it("a write records an unreadable file, so the kit list shows the kit quarantined straight away", async () => {
      importCard();
      fs.writeFileSync(path.join(store, "A3", "1 PAD.wav"), "not a wav file");
      expect(status("A3", "1 PAD.wav")).toBe("readable");

      await write();

      expect(status("A3", "1 PAD.wav")).toBe("unreadable");
      const listed = (getKits(dbDir).data ?? []).find((k) => k.name === "A3");
      expect(listed?.quarantined).toBe(true);
    });

    it("a write records a missing file it skipped, and clears it once the file is back", async () => {
      importCard();
      const hat = path.join(store, "A1", "3 HAT.wav");
      const bytes = fs.readFileSync(hat);
      fs.rmSync(hat);

      const skipped = await syncService.startKitSync(settings(), {
        sdCardPath: card,
        skipInvalidFiles: true,
      });

      expect(skipped.success, skipped.error).toBe(true);
      expect(status("A1", "3 HAT.wav")).toBe("missing");
      expect(getKit(dbDir, "A1").data!.quarantined).toBe(false);

      // Back again: the next write clears it, and the kit-open check
      // reads it afresh
      fs.writeFileSync(hat, bytes);
      await write();
      expect(status("A1", "3 HAT.wav")).toBeNull();
    });

    it("a cancelled write records no file problems", async () => {
      importCard();
      fs.writeFileSync(path.join(store, "A3", "1 PAD.wav"), "not a wav file");
      const emit =
        syncProgressManager.emitFileCompletionProgress.bind(
          syncProgressManager,
        );
      vi.spyOn(
        syncProgressManager,
        "emitFileCompletionProgress",
      ).mockImplementation((fileOp) => {
        emit(fileOp);
        syncService.cancelSync();
      });

      const result = await syncService.startKitSync(settings(), {
        sdCardPath: card,
      });

      expect(result.data?.cancelled).toBe(true);
      expect(status("A3", "1 PAD.wav")).toBe("readable");
    });

    it("a missing file doesn't quarantine its kit", async () => {
      importCard();
      fs.rmSync(path.join(store, "A1", "3 HAT.wav"));
      expect(scanService.rescanKit(settings(), "A1").success).toBe(true);
      expect(status("A1", "3 HAT.wav")).toBe("missing");
      expect(getKit(dbDir, "A1").data!.quarantined).toBe(false);
    });

    it("the kit list says which kits are quarantined", () => {
      importCard();
      // A3's voice 1 holds a mono kick beside its stereo pad: linking it
      // makes a pair with a mono sample
      expect(updateVoiceStereoMode(dbDir, "A3", 1, true).success).toBe(true);

      const quarantined = Object.fromEntries(
        (getKits(dbDir).data ?? []).map((kit) => [kit.name, kit.quarantined]),
      );
      expect(quarantined).toEqual({
        A0: false,
        A1: false,
        A2: false,
        A3: true,
      });
      expect(getKit(dbDir, "A3").data!.quarantined).toBe(true);
    });
  });
});
