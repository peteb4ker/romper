import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  _electron as electron,
  type ElectronApplication,
  type Locator,
  type Page,
} from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/**
 * Give the fixture library kits that differ in everything a card shows,
 * before the app opens it:
 *
 * - A0, "Boom Room": an editable drum kit (kick, snare, hat on voices 1-3),
 *   a favourite, changed since the last write, with 12 samples on voice 1
 *   and 1 on voices 2 and 3
 * - B1: a factory (read-only) vocal kit with voices 1 and 2 stereo-linked,
 *   1 sample on voices 1 and 2
 * - C5: an empty editable kit with no voice names
 */
async function shapeLibrary(localStorePath: string) {
  const kick = path.join(localStorePath, "A0", "1_kick.wav");
  const snare = path.join(localStorePath, "A0", "2_snare.wav");
  await fs.mkdir(path.join(localStorePath, "C5"));

  const db = new DatabaseSync(
    path.join(localStorePath, ".romperdb", "romper.sqlite"),
  );
  try {
    db.prepare(
      `UPDATE kits SET alias = 'Boom Room', editable = 1, is_favorite = 1,
         modified_since_sync = 1 WHERE name = 'A0'`,
    ).run();
    const voiceAlias = db.prepare(
      "UPDATE voices SET voice_alias = ? WHERE kit_name = ? AND voice_number = ?",
    );
    voiceAlias.run("kick", "A0", 1);
    voiceAlias.run("snare", "A0", 2);
    voiceAlias.run("hat", "A0", 3);

    // Voice 1 fills its 12 slots; voice 3 gets one sample
    const addSample = db.prepare(
      `INSERT INTO samples (kit_name, filename, voice_number, slot_number, source_path)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (let slot = 1; slot < 12; slot++) {
      const file = path.join(localStorePath, "A0", `1_kick_${slot}.wav`);
      await fs.copyFile(kick, file);
      addSample.run("A0", path.basename(file), 1, slot, file);
    }
    const hat = path.join(localStorePath, "A0", "3_hat.wav");
    await fs.copyFile(snare, hat);
    addSample.run("A0", "3_hat.wav", 3, 0, hat);

    // B1 stays a factory kit (editable = 0): vocals, voices 1+2 linked
    voiceAlias.run("vox", "B1", 1);
    voiceAlias.run("vox", "B1", 2);
    db.prepare(
      "UPDATE voices SET stereo_mode = 1 WHERE kit_name = 'B1' AND voice_number IN (1, 2)",
    ).run();

    db.prepare(
      "INSERT INTO kits (name, bank_letter, editable) VALUES ('C5', 'C', 1)",
    ).run();
    const addVoice = db.prepare(
      "INSERT INTO voices (kit_name, voice_number) VALUES ('C5', ?)",
    );
    for (let voice = 1; voice <= 4; voice++) addVoice.run(voice);
  } finally {
    db.close();
  }
}

/** The voice strip cell for one voice, found by its tooltip */
function voiceCell(card: Locator, tooltip: string): Locator {
  return card.locator(`[title="${tooltip}"]`);
}

/**
 * UC-08: the kit browser's cards show what's in each kit of a real library,
 * read from the database the app opened: kit ID and alias, kit type, the
 * voice strip's names and counts, and the stereo, favourite, read-only and
 * modified markers.
 */
test.describe("[UC-08] Kit card details", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const card = (kit: string) =>
    window.locator(`[data-testid="kit-item-${kit}"]`);

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    await shapeLibrary(testEnv.localStorePath);
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
    await expect(card("C5")).toBeVisible();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("an edited favourite drum kit: alias, voice strip, star and modified border", async () => {
    const a0 = card("A0");

    await expect(a0).toHaveAttribute("aria-label", "Kit A0 - 14 samples");
    await expect(a0).toContainText("A0");
    await expect(a0.getByTitle("Kit alias: Boom Room")).toHaveText("Boom Room");
    await expect(a0.getByTitle("Drum Kit")).toBeVisible();

    // Voice strip: each voice's name and sample count
    for (const [tooltip, name, count] of [
      ["Voice 1: 12 samples (kick)", "Kick", "12"],
      ["Voice 2: 1 samples (snare)", "Snare", "1"],
      ["Voice 3: 1 samples (hat)", "Hat", "1"],
      ["Voice 4: 0 samples", "", "0"],
    ]) {
      const cell = voiceCell(a0, tooltip);
      await expect(cell).toBeVisible();
      await expect(cell).toContainText(count);
      if (name) await expect(cell).toContainText(name);
    }
    // A full voice is set apart from a partly filled or empty one
    await expect(
      voiceCell(a0, "Voice 1: 12 samples (kick)").getByText("12"),
    ).toHaveClass(/font-bold/);
    await expect(
      voiceCell(a0, "Voice 4: 0 samples").getByText("0"),
    ).toHaveClass(/text-accent-danger/);

    // Favourite, editable (no lock), changed since the last write, not stereo
    await expect(a0.getByTitle("Remove from favorites")).toBeVisible();
    await expect(a0.getByTestId("lock-icon")).toHaveCount(0);
    await expect(a0).toHaveClass(/border-accent-warning/);
    await expect(a0.getByTestId("stereo-indicator")).toHaveCount(0);
  });

  test("a factory vocal kit: lock, stereo and no modified border", async () => {
    const b1 = card("B1");

    await expect(b1).toHaveAttribute("aria-label", "Kit B1 - 2 samples");
    await expect(b1.getByTitle("Vocal Kit")).toBeVisible();
    await expect(b1.getByTestId("lock-icon")).toHaveAttribute(
      "title",
      "Factory kit (read-only)",
    );
    await expect(b1.getByTestId("stereo-indicator")).toHaveAttribute(
      "title",
      "Has stereo-linked voices",
    );
    await expect(voiceCell(b1, "Voice 1: 1 samples (vox)")).toContainText(
      "Vox",
    );
    await expect(voiceCell(b1, "Voice 2: 1 samples (vox)")).toContainText(
      "Vox",
    );

    await expect(b1.getByTitle("Add to favorites")).toBeVisible();
    await expect(b1).not.toHaveClass(/border-accent-warning/);
    await expect(b1.getByTitle(/^Kit alias/)).toHaveCount(0);
  });

  test("an empty kit: folder icon and no voice strip", async () => {
    const c5 = card("C5");

    await expect(c5).toHaveAttribute("aria-label", "Kit C5 - 0 samples");
    await expect(c5.getByTitle("Folder")).toBeVisible();
    await expect(c5.locator('[title^="Voice "]')).toHaveCount(0);
    await expect(c5.getByTestId("lock-icon")).toHaveCount(0);
    await expect(c5.getByTestId("stereo-indicator")).toHaveCount(0);
  });

  test("a card follows a change made in the editor", async () => {
    // Making factory kit B1 editable takes the lock off its card
    await card("B1").click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
    await window
      .locator('[data-testid="kit-header"]')
      .getByTitle("Back")
      .click();

    await expect(card("B1")).toBeVisible();
    await expect(card("B1").getByTestId("lock-icon")).toHaveCount(0);
    await expect(card("B1").getByTestId("stereo-indicator")).toBeVisible();
  });
});
