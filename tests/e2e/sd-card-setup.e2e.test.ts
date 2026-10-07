import {
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { expect, test } from "../utils/e2e-error-guard";
import { openStoreDb } from "../utils/e2e-store-db";
import { encodeTestWav, sine } from "../validation/support/wav";

interface SampleRow {
  filename: string;
  kit_name: string;
  slot_number: number;
  source_path: string;
  voice_number: number;
}

/** Each kit's voices linked as stereo, from the store's database */
function linkedVoices(storePath: string): string[] {
  const db = openStoreDb(storePath, { readOnly: true });
  try {
    return (
      db
        .prepare(
          "SELECT kit_name, voice_number FROM voices WHERE stereo_mode = 1 ORDER BY kit_name, voice_number",
        )
        .all() as { kit_name: string; voice_number: number }[]
    ).map((v) => `${v.kit_name}:${v.voice_number}`);
  } finally {
    db.close();
  }
}

/** A short stereo tone, a different pitch on each channel */
async function writeStereoWav(file: string) {
  await fs.outputFile(
    file,
    encodeTestWav([sine(220, 0.05, 44100), sine(330, 0.05, 44100)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
}

/** A short mono tone, as a Rample would play it */
async function writeWav(file: string, hz = 220) {
  await fs.outputFile(
    file,
    encodeTestWav([sine(hz, 0.05, 44100)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
}

const kickName = (i: number) => `1 KICK ${String(i).padStart(2, "0")}.wav`;

/** Each named bank's name, from the store's database */
function bankNames(storePath: string): Record<string, string> {
  const db = openStoreDb(storePath, { readOnly: true });
  try {
    const rows = db
      .prepare(
        "SELECT letter, artist FROM banks WHERE artist IS NOT NULL ORDER BY letter",
      )
      .all() as { artist: string; letter: string }[];
    return Object.fromEntries(rows.map((b) => [b.letter, b.artist]));
  } finally {
    db.close();
  }
}

/**
 * A Rample SD card with three kits, one voice over the 12-sample limit, and
 * things that aren't kits:
 *
 * - A0: 13 kicks on voice 1 (one too many), a snare on voice 2
 * - B1: a hat on voice 1, a clap on voice 3
 * - C12: a bass on voice 4
 * - the Rample's `_save` folder, a text file and a folder not named like a
 *   kit, which setup leaves alone
 */
async function buildCard(card: string) {
  for (let i = 1; i <= 13; i++) {
    await writeWav(path.join(card, "A0", kickName(i)), 100 + i);
  }
  await writeWav(path.join(card, "A0", "2 SNARE.wav"));
  await writeWav(path.join(card, "B1", "1 HAT.wav"));
  await writeWav(path.join(card, "B1", "3 CLAP.wav"));
  await writeWav(path.join(card, "C12", "4 BASS.wav"));
  await fs.outputFile(path.join(card, "_save", "A0.dat"), "rample state");
  await fs.outputFile(path.join(card, "readme.txt"), "not a kit");
  await writeWav(path.join(card, "Drums", "1 KICK.wav"));
}

function readStore(storePath: string) {
  const db = openStoreDb(storePath, { readOnly: true });
  try {
    const kits = (
      db.prepare("SELECT name FROM kits ORDER BY name").all() as {
        name: string;
      }[]
    ).map((k) => k.name);
    const samples = db
      .prepare(
        `SELECT kit_name, filename, voice_number, slot_number, source_path
           FROM samples ORDER BY kit_name, voice_number, slot_number`,
      )
      .all() as unknown as SampleRow[];
    const voiceNames = db
      .prepare(
        "SELECT kit_name, voice_number, voice_alias FROM voices WHERE voice_alias IS NOT NULL",
      )
      .all() as {
      kit_name: string;
      voice_alias: string;
      voice_number: number;
    }[];
    return { kits, samples, voiceNames };
  } finally {
    db.close();
  }
}

/**
 * UC-01 end to end: on first launch, the setup wizard copies a Rample SD
 * card's kit folders into a new local store and imports them; a voice with
 * more than 12 samples keeps the first 12, and the wizard says what it left
 * out. The kits then arrive in the kit browser and the kit editor.
 */
test.describe("[UC-01] Set up from an SD card", () => {
  test.use({
    expectedMessages: {
      "the test starts with no local store, so the wizard opens": {
        pattern: /No local store configured/,
        sources: ["main-stdout"],
      },
    },
  });

  let electronApp: ElectronApplication;
  let tempDirs: string[] = [];

  async function tempDir(prefix: string) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  test.afterEach(async () => {
    await electronApp?.close();
    for (const dir of tempDirs) await fs.remove(dir).catch(() => {});
    tempDirs = [];
  });

  /**
   * Launch with no store, set up from `card` into a new folder, and wait
   * for the wizard's closing notice. Returns the window and the store path.
   * A card with nothing to report has no notice: with `notice: false`, wait
   * for the wizard to close instead.
   */
  async function setUpFrom(card: string, { notice = true } = {}) {
    // The store goes in a new folder that doesn't exist yet
    const store = path.join(await tempDir("romper-e2e-setup-"), "Romper");
    electronApp = await electron.launch({
      args: [
        "dist/electron/main/index.js",
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
      env: {
        ...process.env,
        ROMPER_SDCARD_PATH: card,
        ROMPER_USER_DATA_DIR: await tempDir("romper-e2e-userdata-"),
      },
      timeout: 30000,
    });
    // Typing the target path makes main ask to approve it (RE-03)
    await approveLocalStorePrompts(electronApp);
    const window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="local-store-wizard"]', {
      timeout: 10000,
    });

    // Source: the SD card. Target: the new folder
    await window.locator('[data-testid="wizard-source-sdcard"]').click();
    await window.locator("#local-store-path-input").fill(store);
    await window.locator('[data-testid="wizard-initialize-btn"]').click();

    const guidance = window.locator(
      '[data-testid="wizard-post-init-guidance"]',
    );
    if (notice) {
      await expect(guidance).toBeVisible({ timeout: 20000 });
    } else {
      await expect(
        window.locator('[data-testid="local-store-wizard"]'),
      ).toHaveCount(0, { timeout: 20000 });
    }
    return { guidance, store, window };
  }

  test("the card's kits and samples arrive, and the notice names the voice over 12", async () => {
    test.setTimeout(45000);
    const card = await tempDir("romper-e2e-card-");
    await buildCard(card);
    const { guidance, store, window } = await setUpFrom(card);

    // The notice says which voice went over and what was kept
    const notice = guidance.locator('[data-testid="truncation-warnings"]');
    await expect(notice).toContainText(
      "Some samples were skipped (max 12 per voice)",
    );
    const voices = notice.locator('[data-testid="truncation-warning"]');
    await expect(voices).toHaveCount(1);
    await expect(
      voices.locator('[data-testid="truncation-warning-summary"]'),
    ).toHaveText("Kit A0, Voice 1: 1 of 13 samples skipped (kept first 12):");
    await expect(
      guidance.locator('[data-testid="blank-folder-guidance"]'),
    ).toHaveCount(0);

    // The store has the card's kits, and only its kits
    const { kits, samples, voiceNames } = readStore(store);
    expect(kits).toEqual(["A0", "B1", "C12"]);
    const a0v1 = samples.filter(
      (s) => s.kit_name === "A0" && s.voice_number === 1,
    );
    expect(a0v1.map((s) => s.filename)).toEqual(
      Array.from({ length: 12 }, (_, i) => kickName(i + 1)),
    );
    expect(a0v1.map((s) => s.slot_number)).toEqual(
      Array.from({ length: 12 }, (_, i) => i),
    );
    expect(
      samples
        .filter((s) => !(s.kit_name === "A0" && s.voice_number === 1))
        .map((s) => [s.kit_name, s.voice_number, s.filename]),
    ).toEqual([
      ["A0", 2, "2 SNARE.wav"],
      ["B1", 1, "1 HAT.wav"],
      ["B1", 3, "3 CLAP.wav"],
      ["C12", 4, "4 BASS.wav"],
    ]);
    // Samples point at the store's copies, not the card
    for (const s of samples) {
      expect(s.source_path).toBe(path.join(store, s.kit_name, s.filename));
      expect(await fs.pathExists(s.source_path)).toBe(true);
    }
    const voiceName = (kit: string, voice: number) =>
      voiceNames.find((v) => v.kit_name === kit && v.voice_number === voice)
        ?.voice_alias;
    expect(voiceName("A0", 1)).toMatch(/kick/i);
    expect(voiceName("A0", 2)).toMatch(/snare/i);
    expect(voiceName("C12", 4)).toMatch(/bass/i);
    // Folders that aren't kits weren't copied
    expect(await fs.pathExists(path.join(store, "Drums"))).toBe(false);
    expect(await fs.pathExists(path.join(store, "_save"))).toBe(false);
    // The card itself is untouched
    expect(await fs.readdir(path.join(card, "A0"))).toHaveLength(14);

    // Continue opens the kit browser with the card's kits
    await guidance.locator('[data-testid="post-init-continue-btn"]').click();
    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toHaveCount(0);
    for (const [kit, total] of [
      ["A0", 13],
      ["B1", 2],
      ["C12", 1],
    ] as const) {
      await expect(
        window.locator(`[data-testid="kit-item-${kit}"]`),
      ).toHaveAttribute("aria-label", `Kit ${kit} - ${total} samples`);
    }
    await expect(
      window
        .locator('[data-testid="kit-item-A0"]')
        .locator('[title^="Voice 1: 12 samples"]'),
    ).toContainText(/kick/i);

    // And the kit editor shows A0's first 12 kicks, without the 13th
    await window.locator('[data-testid="kit-item-A0"]').click();
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();
    const voice1 = window.locator('[data-testid="sample-list-voice-1"]');
    await expect(voice1.getByRole("option")).toHaveCount(12);
    await expect(
      voice1.getByRole("option", { name: `Sample ${kickName(1)} in slot 1` }),
    ).toBeVisible();
    await expect(
      voice1.getByRole("option", {
        name: `Sample ${kickName(12)} in slot 12`,
      }),
    ).toBeVisible();
    await expect(voice1).not.toContainText(kickName(13));
    await expect(
      window
        .locator('[data-testid="sample-list-voice-2"]')
        .getByRole("option", { name: "Sample 2 SNARE.wav in slot 1" }),
    ).toBeVisible();
  });

  // #537: a card's stereo samples stayed mono, so the next write mixed
  // them down. Setup links a voice automatically when every sample on it is
  // stereo and the next voice is free, and its summary says so; a voice it
  // can't link is a mono voice, with a note that it's mixed down.
  test("[UC-28] [Q-04] a stereo voice arrives linked automatically, and a mono voice says it's mixed down (#537)", async () => {
    test.setTimeout(45000);
    const card = await tempDir("romper-e2e-card-");
    // A0: a stereo pad on voice 1, voice 2 empty. B1: a stereo pad on
    // voice 2, with a mono hat on voice 3
    await writeStereoWav(path.join(card, "A0", "1 PAD.wav"));
    await writeWav(path.join(card, "A0", "3 KICK.wav"));
    await writeStereoWav(path.join(card, "B1", "2 PAD.wav"));
    await writeWav(path.join(card, "B1", "3 HAT.wav"));
    const { guidance, store, window } = await setUpFrom(card);

    await expect(
      guidance.locator('[data-testid="stereo-summary"] li'),
    ).toHaveText([
      "Kit A0: voices 1 and 2 linked automatically as a stereo pair.",
    ]);
    expect(linkedVoices(store)).toEqual(["A0:1"]);
    // Nothing was moved or left out
    expect(
      readStore(store).samples.map((s) => [
        s.kit_name,
        s.voice_number,
        s.filename,
      ]),
    ).toEqual([
      ["A0", 1, "1 PAD.wav"],
      ["A0", 3, "3 KICK.wav"],
      ["B1", 2, "2 PAD.wav"],
      ["B1", 3, "3 HAT.wav"],
    ]);

    // The kit editor shows A0's pair, labelled as linked automatically
    await guidance.locator('[data-testid="post-init-continue-btn"]').click();
    await window.locator('[data-testid="kit-item-A0"]').click();
    await expect(window.locator('[data-testid="kit-editor"]')).toBeVisible();
    await expect(
      window.locator('[data-testid="stereo-badge-1"]'),
    ).toBeVisible();
    await expect(
      window.locator('[data-testid="auto-linked-label-1"]'),
    ).toHaveText("Linked automatically");

    // And notes that B1's voice 2 is mixed down
    await window.keyboard.press("Escape");
    await window.locator('[data-testid="kit-item-B1"]').click();
    await expect(window.locator('[data-testid="stereo-note-2"]')).toHaveText(
      "Mixed down to mono instead of playing across 2 voices",
    );
  });

  // #564: setup copied only the card's kit folders, so its bank names never
  // reached the store, and the first write back to the card removed them.
  // Setup now imports them, and the write puts them back unchanged.
  test("[UC-12] [UC-34] the card's bank names arrive, and a write back to the card keeps them (#564)", async () => {
    test.setTimeout(60000);
    const card = await tempDir("romper-e2e-card-");
    await writeWav(path.join(card, "A0", "1 KICK.wav"));
    // A bank with kits, and one without
    await fs.outputFile(path.join(card, "A - ALWIS.rtf"), String.raw`{\rtf1}`);
    await fs.outputFile(path.join(card, "D - Night Shift.rtf"), "");
    const { store, window } = await setUpFrom(card, { notice: false });

    // The names are in the store's database, not copied into it as files
    expect(bankNames(store)).toEqual({ A: "ALWIS", D: "Night Shift" });
    expect((await fs.readdir(store)).filter((f) => f.endsWith(".rtf"))).toEqual(
      [],
    );

    await expect(
      window.locator('[data-testid="bank-name-display-A"]'),
    ).toHaveText("ALWIS");

    // Write back to the card setup came from
    await window.locator('[data-testid="sync-to-sd-card"]').click();
    await window
      .locator('[data-testid="bank-summary"]')
      .waitFor({ state: "visible", timeout: 10000 });
    await window.locator('[data-testid="confirm-sync"]').click();
    await window
      .locator("text=Write Complete")
      .waitFor({ state: "visible", timeout: 15000 });

    const rtfFiles = (await fs.readdir(card))
      .filter((f) => f.endsWith(".rtf"))
      .sort((a, b) => a.localeCompare(b));
    expect(rtfFiles).toEqual(["A - ALWIS.rtf", "D - Night Shift.rtf"]);
  });

  test("the notice names the files it left out (#518)", async () => {
    test.setTimeout(45000);
    const card = await tempDir("romper-e2e-card-");
    for (let i = 1; i <= 14; i++) {
      await writeWav(path.join(card, "A0", kickName(i)), 100 + i);
    }
    const { guidance } = await setUpFrom(card);

    const notice = guidance.locator('[data-testid="truncation-warnings"]');
    await expect(notice).toContainText("2 of 14 samples skipped");
    await expect(
      notice.locator('[data-testid="truncation-warning-files"] li'),
    ).toHaveText([kickName(13), kickName(14)]);
  });
});
