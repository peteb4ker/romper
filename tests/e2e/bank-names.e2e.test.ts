import * as fs from "node:fs";
import * as path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import type { ElectronAPI } from "../../shared/electronApi";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

type ApiWindow = { electronAPI: ElectronAPI } & typeof globalThis;

// RE-23: clearing a bank name deleted its RTF file but kept the name in the
// database, so it came back after a relaunch and was written to the card.
test.describe("[UC-12] Bank names", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const launch = async () => {
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
  };

  const setBankName = async (name: string, bank = "A") => {
    await window.locator(`[data-testid="bank-name-edit-${bank}"]`).click();
    const input = window.locator(`[data-testid="bank-name-input-${bank}"]`);
    await input.fill(name);
    await input.press("Enter");
  };

  const bankAName = () =>
    window.evaluate(async () => {
      const res = await (
        globalThis as unknown as ApiWindow
      ).electronAPI.getAllBanks();
      return res.data?.find((bank) => bank.letter === "A")?.artist ?? null;
    });

  const cardRtfFiles = () =>
    fs
      .readdirSync(testEnv.tempSdcardPath)
      .filter((file) => file.endsWith(".rtf"));

  const writeToCard = async () => {
    const result = await window.evaluate(
      (sdCardPath) =>
        (globalThis as unknown as ApiWindow).electronAPI.startKitSync({
          sdCardPath,
        }),
      testEnv.tempSdcardPath,
    );
    expect(result.success).toBe(true);
  };

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    await launch();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
  });

  test("a cleared name stays gone after a relaunch and a write", async () => {
    const display = window.locator('[data-testid="bank-name-display-A"]');

    await setBankName("Test Artist");
    await expect(display).toHaveText("Test Artist");
    await writeToCard();
    expect(cardRtfFiles()).toEqual(["A - Test Artist.rtf"]);

    await setBankName("");
    await expect(display).toHaveCount(0);
    expect(await bankAName()).toBeNull();

    // Relaunch: the names load from the database again
    await electronApp.close();
    await launch();
    await expect(
      window.locator('[data-testid="bank-name-edit-A"]'),
    ).toBeVisible();
    await expect(
      window.locator('[data-testid="bank-name-display-A"]'),
    ).toHaveCount(0);
    expect(await bankAName()).toBeNull();

    await writeToCard();
    expect(cardRtfFiles()).toEqual([]);
  });

  // RE-90: the browser read bank names from the kits, so a bank with no
  // kits lost its name on reload. #567: the name shows without a relaunch
  // too, read back from the banks, and the store's name files are never
  // read.
  test("a bank with no kits shows its new name, and keeps it after a relaunch", async () => {
    const bankC = () => window.getByRole("button", { name: "Jump to bank C" });
    const bankD = () => window.getByRole("button", { name: "Jump to bank D" });

    await bankC().click();
    await setBankName("Empty Bank", "C");
    await expect(
      window.locator('[data-testid="bank-name-display-C"]'),
    ).toHaveText("Empty Bank");
    await expect(bankC()).toHaveAttribute("title", "Empty Bank");

    // A name file made by hand in the store isn't a bank name
    fs.writeFileSync(
      path.join(testEnv.localStorePath, "D - Hand Made.rtf"),
      String.raw`{\rtf1}`,
    );
    await electronApp.close();
    await launch();

    await expect(bankC()).toHaveAttribute("title", "Empty Bank");
    await expect(bankD()).not.toHaveAttribute("title", "Hand Made");
    await bankC().click();
    await expect(
      window.locator('[data-testid="bank-name-display-C"]'),
    ).toHaveText("Empty Bank");
  });

  test.describe("a name the card can't hold", () => {
    test.use({
      expectedMessages: {
        "the test types a name with a slash, which main refuses": {
          pattern: /A bank name can't contain/,
          sources: ["ui", "renderer-console"],
        },
      },
    });

    test("is refused with a message", async () => {
      await setBankName("AC/DC");

      await expect(window.getByText("A bank name can't contain")).toBeVisible();
      await expect(
        window.locator('[data-testid="bank-name-display-A"]'),
      ).toHaveCount(0);
      expect(await bankAName()).toBeNull();
    });
  });
});
