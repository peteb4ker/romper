import {
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { appEnv } from "../utils/e2e-app-env";
import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { expect, test } from "../utils/e2e-error-guard";
import {
  GENERATED_SAMPLES,
  generatedFactoryArchive,
} from "../utils/generated-library";
import {
  decodeWav,
  maxSampleDifference,
  readPcm16,
  readWavInfo,
  referenceConversion,
} from "../validation/support/wav";

/**
 * What each generated sample should become on the card. Copied: the
 * Rample plays it as it is, so the card file is the source byte for byte.
 * Converted: 16-bit, 44.1 kHz, with the channels given. B1's voices 1 and
 * 2 arrive linked as stereo, so PAD stays stereo; voice 4 can't be linked,
 * so LOOP is mixed down to mono.
 */
const CARD: Record<
  string,
  { as: "convert"; channels: 1 | 2 } | { as: "copy" }
> = {
  "A0/1-01 KICK 1.wav": { as: "copy" },
  "A0/1-02 KICK 2.wav": { as: "copy" },
  "A0/2-01 SNARE.wav": { as: "copy" },
  "B1/1-01 PAD 1.wav": { as: "copy" },
  "B1/1-02 PAD 2.wav": { as: "convert", channels: 2 },
  "B1/3-01 HAT.wav": { as: "convert", channels: 1 },
  "B1/4-01 LOOP.wav": { as: "convert", channels: 1 },
};

/** The generated sample a card file was written from */
function sourceOf(cardPath: string) {
  const [kit, file] = cardPath.split("/");
  const name = file.replace(/^\d-\d{2} /, "");
  const source = GENERATED_SAMPLES.find(
    (s) => s.kit === kit && s.file.slice(2) === name,
  );
  if (!source) throw new Error(`no generated sample for ${cardPath}`);
  return source;
}

/**
 * RE-67: Romper's main promise as one flow, through the UI of the built
 * app. Set up a library from the factory archive, then write it to an
 * empty card, and compare every file on the card with what it should be.
 * The archive is generated (tests/utils/generated-library.ts): real WAV
 * audio, mono and stereo, in formats the Rample plays and formats Romper
 * converts. Converted files are checked against the validation harness's
 * own reference conversion, which shares no code with the app's.
 */
test.describe("[UC-02] [UC-28] [UC-34] [Q-07] From the factory archive to the card", () => {
  test.use({
    expectedMessages: {
      "the test starts with no local store, so the wizard opens": {
        pattern: /No local store configured/,
        sources: ["main-stdout"],
      },
    },
  });

  let electronApp: ElectronApplication | undefined;
  let tempDir: string;

  test.beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-workflow-"));
  });

  test.afterEach(async () => {
    await electronApp?.close();
    await fs.remove(tempDir).catch(() => {});
  });

  test("every sample reaches the card intact: copied byte for byte, or converted correctly", async () => {
    test.setTimeout(90000);
    const archive = path.join(tempDir, "factory.zip");
    await fs.writeFile(archive, generatedFactoryArchive());
    const store = path.join(tempDir, "Romper");
    // An empty card but for the Rample's own saved settings
    const card = path.join(tempDir, "card");
    const saved = Buffer.from("rample state");
    await fs.outputFile(path.join(card, "_save", "A0.rpl"), saved);

    electronApp = await electron.launch({
      args: [
        "dist/electron/main/index.js",
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
      env: appEnv({
        ROMPER_SDCARD_PATH: card,
        ROMPER_SQUARP_ARCHIVE_URL: pathToFileURL(archive).href,
        ROMPER_USER_DATA_DIR: path.join(tempDir, "user-data"),
      }),
      timeout: 30000,
    });
    // The typed target path makes main ask the user to approve it (RE-03)
    await approveLocalStorePrompts(electronApp);
    const window = await electronApp.firstWindow();

    // Set up from the factory archive
    await window.locator('[data-testid="wizard-source-squarp"]').click();
    await window.locator("#local-store-path-input").fill(store);
    await window.locator('[data-testid="wizard-initialize-btn"]').click();
    // Setup says it linked B1's stereo voices
    const guidance = window.locator(
      '[data-testid="wizard-post-init-guidance"]',
    );
    await expect(guidance).toContainText(
      "Kit B1: voices 1 and 2 linked automatically as a stereo pair.",
      { timeout: 30000 },
    );
    await window.locator('[data-testid="post-init-continue-btn"]').click();
    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toHaveCount(0);

    // The kits arrive in the browser
    await expect(window.locator('[data-testid^="kit-item-"]')).toHaveCount(2);

    // Write to the card: the summary counts what will be written
    await window.locator('[data-testid="sync-to-sd-card"]').click();
    await window
      .locator('[data-testid="bank-summary"]')
      .waitFor({ state: "visible", timeout: 10000 });
    await expect(window.locator('[data-testid="total-kits"]')).toHaveText("2");
    await expect(window.locator('[data-testid="total-samples"]')).toHaveText(
      String(GENERATED_SAMPLES.length),
    );
    await window.locator('[data-testid="confirm-sync"]').click();
    await window
      .locator("text=Write Complete")
      .waitFor({ state: "visible", timeout: 20000 });

    // The card holds the kits, the bank name and the Rample's own folder
    expect((await fs.readdir(card)).sort()).toEqual([
      "A - ALWIS.rtf",
      "A0",
      "B1",
      "_save",
    ]);
    expect(await fs.readFile(path.join(card, "_save", "A0.rpl"))).toEqual(
      saved,
    );
    // Each kit folder holds exactly its samples; voice 2 of B1's pair, none
    const written: string[] = [];
    for (const kit of ["A0", "B1"]) {
      for (const file of await fs.readdir(path.join(card, kit))) {
        written.push(`${kit}/${file}`);
      }
    }
    expect(written.sort()).toEqual(Object.keys(CARD).sort());

    for (const [cardPath, expected] of Object.entries(CARD)) {
      const bytes = await fs.readFile(path.join(card, cardPath));
      const source = sourceOf(cardPath);
      if (expected.as === "copy") {
        expect(bytes.equals(source.bytes), cardPath).toBe(true);
        continue;
      }
      const info = readWavInfo(bytes);
      expect(
        `${info.bitDepth}-bit ${info.encoding} ${info.sampleRate} Hz, ${info.channels} ch`,
        cardPath,
      ).toBe(`16-bit pcm 44100 Hz, ${expected.channels} ch`);
      const reference = referenceConversion(decodeWav(source.bytes), {
        gainDb: 0,
        outputChannels: expected.channels,
      });
      // Within one step of the reference, sample by sample
      expect(
        maxSampleDifference(readPcm16(bytes), reference),
        cardPath,
      ).toBeLessThanOrEqual(1);
    }
  });
});
