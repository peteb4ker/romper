import {
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { expect, test } from "../utils/e2e-error-guard";
import { encodeTestWav, sine } from "../validation/support/wav";

interface SampleRow {
  filename: string;
  kit_name: string;
  slot_number: number;
  source_path: string;
  voice_number: number;
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
  const db = new DatabaseSync(
    path.join(storePath, ".romperdb", "romper.sqlite"),
    { readOnly: true },
  );
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
   */
  async function setUpFrom(card: string) {
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
    await expect(guidance).toBeVisible({ timeout: 20000 });
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
    await expect(notice.locator("li")).toHaveCount(1);
    await expect(notice.locator("li")).toHaveText(
      "Kit A0, Voice 1: 1 of 13 samples skipped (kept first 12)",
    );
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

  test("the notice names the files it left out (#518)", async () => {
    // UC-01 says the wizard names the files it left out; the notice gives
    // counts only. Remove this line when #518 is fixed.
    test.fail();
    test.setTimeout(45000);
    const card = await tempDir("romper-e2e-card-");
    for (let i = 1; i <= 14; i++) {
      await writeWav(path.join(card, "A0", kickName(i)), 100 + i);
    }
    const { guidance } = await setUpFrom(card);

    const notice = guidance.locator('[data-testid="truncation-warnings"]');
    await expect(notice).toContainText("2 of 14 samples skipped");
    await expect(notice).toContainText(kickName(13));
    await expect(notice).toContainText(kickName(14));
  });
});
