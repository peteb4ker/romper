import fs from "fs-extra";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";
import { openStoreDb } from "../utils/e2e-store-db";

interface KitRow {
  alias: null | string;
  editable: number;
  name: string;
}

interface SampleRow {
  filename: string;
  slot_number: number;
  voice_number: number;
}

/**
 * RE-67: the kit and sample edits the traceability matrix had no e2e for,
 * through the built app's UI, each checked in the store's database the
 * app wrote. The fixture library has kits A0 and B1, each with a kick on
 * voice 1 and a snare on voice 2, both read-only.
 */
test.describe("[Q-07] Editing kits in the app", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const card = (kit: string) =>
    window.locator(`[data-testid="kit-item-${kit}"]`);

  function kit(name: string): KitRow | undefined {
    const db = openStoreDb(testEnv.localStorePath, { readOnly: true });
    try {
      return db
        .prepare("SELECT name, alias, editable FROM kits WHERE name = ?")
        .get(name) as KitRow | undefined;
    } finally {
      db.close();
    }
  }

  function samples(kitName: string): SampleRow[] {
    const db = openStoreDb(testEnv.localStorePath, { readOnly: true });
    try {
      return db
        .prepare(
          `SELECT voice_number, slot_number, filename FROM samples
            WHERE kit_name = ? ORDER BY voice_number, slot_number`,
        )
        .all(kitName) as unknown as SampleRow[];
    } finally {
      db.close();
    }
  }

  async function launch() {
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  }

  /** Open a kit and turn editing on, as the user does */
  async function openEditable(kitName: string) {
    await card(kitName).click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
    await expect(window.getByTitle("Disable editable mode")).toBeVisible();
  }

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("[UC-15] duplicates a kit, samples and all, into the slot typed", async () => {
    await launch();

    await card("A0").getByTitle("Duplicate kit").click();
    await window.getByTestId("duplicate-dest-input").fill("A5");
    await window.getByTestId("confirm-duplicate-button").click();

    await expect(card("A5")).toBeVisible();
    expect(kit("A5")).toMatchObject({ name: "A5" });
    expect(samples("A5")).toEqual(samples("A0"));
    expect(samples("A5")).toHaveLength(2);
  });

  test("[UC-17] makes a kit editable and names it", async () => {
    await launch();
    expect(kit("B1")?.editable).toBe(0);

    await openEditable("B1");
    await window.getByTitle("Edit kit name").click();
    const name = window.getByRole("textbox", { name: "Kit name" });
    await name.fill("Night Shift");
    await name.press("Enter");
    await expect(window.getByTitle("Edit kit name")).toHaveText("Night Shift");

    expect(kit("B1")).toEqual({
      alias: "Night Shift",
      editable: 1,
      name: "B1",
    });

    // The kit's card shows the name and no lock
    await window
      .locator('[data-testid="kit-header"]')
      .getByTitle("Back")
      .click();
    await expect(card("B1").getByTitle("Kit alias: Night Shift")).toHaveText(
      "Night Shift",
    );
    await expect(card("B1").getByTestId("lock-icon")).toHaveCount(0);
  });

  test("[UC-21] moves a sample to another voice by dragging it", async () => {
    await launch();
    await openEditable("A0");

    // Drag the kick onto the snare: it goes in before it, on voice 2
    const kick = window.getByRole("option", {
      name: /^Sample .*kick.* in slot 1$/,
    });
    const snare = window.getByRole("option", {
      name: /^Sample .*snare.* in slot 1$/,
    });
    await kick.dragTo(snare);

    await expect(
      window.getByRole("option", { name: /^Sample .*kick.* in slot 1$/ }),
    ).toHaveCount(1);
    await expect(
      window.getByRole("option", { name: /^Sample .*snare.* in slot 2$/ }),
    ).toHaveCount(1);
    expect(samples("A0")).toEqual([
      { filename: "1_kick.wav", slot_number: 0, voice_number: 2 },
      { filename: "2_snare.wav", slot_number: 1, voice_number: 2 },
    ]);
  });

  test("[UC-16] [Q-04] deletes a kit, and the next write removes it from the card", async () => {
    // An earlier write put both kits on the card
    const sdCard = testEnv.tempSdcardPath;
    for (const name of ["A0", "B1"]) {
      await fs.outputFile(path.join(sdCard, name, "1-01 kick.wav"), "old");
    }
    await launch();
    await openEditable("A0");
    await window
      .locator('[data-testid="kit-header"]')
      .getByTitle("Back")
      .click();

    // Only an editable kit can be deleted, after a popover that counts its
    // samples
    await expect(card("B1").getByTestId("delete-kit-button")).toHaveCount(0);
    await card("A0").getByTestId("delete-kit-button").click();
    await expect(window.getByText("Delete kit A0?")).toBeVisible();
    await expect(
      window.getByText("2 sample references will be removed."),
    ).toBeVisible();
    await window.getByTestId("confirm-delete-button").click();

    await expect(card("A0")).toHaveCount(0);
    expect(kit("A0")).toBeUndefined();
    expect(samples("A0")).toEqual([]);

    // Write: the card loses A0 and keeps B1, now the store's copy
    await window.locator('[data-testid="sync-to-sd-card"]').click();
    await expect(window.getByTestId("card-removals")).toContainText("A0");
    await window.locator('[data-testid="confirm-sync"]').click();
    await window
      .locator("text=Write Complete")
      .waitFor({ state: "visible", timeout: 15000 });
    expect((await fs.readdir(sdCard)).sort()).toEqual(["B1"]);
    expect((await fs.readdir(path.join(sdCard, "B1"))).sort()).toEqual([
      "1-01 kick.wav",
      "2-01 snare.wav",
    ]);
    expect(
      (await fs.readFile(path.join(sdCard, "B1", "1-01 kick.wav"))).equals(
        await fs.readFile(
          path.join(testEnv.localStorePath, "B1", "1_kick.wav"),
        ),
      ),
    ).toBe(true);
  });
});
