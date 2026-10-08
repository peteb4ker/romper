import {
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import AdmZip from "adm-zip";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { appEnv } from "../utils/e2e-app-env";
import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { expect, test } from "../utils/e2e-error-guard";
import { openStoreDb } from "../utils/e2e-store-db";
import { encodeTestWav, sine } from "../validation/support/wav";

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
 * A factory archive laid out like Squarp's: kit folders and bank name files
 * at the root, with macOS's `__MACOSX` copies. Bank D has a name and no
 * kits.
 */
function buildArchive(zipPath: string) {
  const wav = encodeTestWav([sine(220, 0.05, 44100)], {
    bitDepth: 16,
    encoding: "pcm",
    sampleRate: 44100,
  });
  const rtf = Buffer.from(String.raw`{\rtf1\ansi ALWIS}`);
  const zip = new AdmZip();
  zip.addFile("A0/1 KICK.wav", wav);
  zip.addFile("B1/1 HAT.wav", wav);
  zip.addFile("A - ALWIS.rtf", rtf);
  zip.addFile("D - RICHARD DEVINE.rtf", rtf);
  zip.addFile("__MACOSX/._A - ALWIS.rtf", Buffer.from("metadata"));
  zip.writeZip(zipPath);
}

/**
 * UC-02 with UC-12: the startup scan that used to read the store's bank
 * name files is gone (#567), so setup reads the factory archive's files
 * itself, once, into the store's database. The names show straight away,
 * an empty bank's too.
 */
test.describe("[UC-02] [UC-12] Set up from the factory archive", () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-factory-"));
  });

  test.afterEach(async () => {
    await electronApp?.close();
    await fs.remove(tempDir).catch(() => {});
  });

  test("the archive's bank names arrive and show without a relaunch (#567)", async () => {
    test.setTimeout(60000);
    const archive = path.join(tempDir, "factory.zip");
    buildArchive(archive);
    const store = path.join(tempDir, "Romper");

    electronApp = await electron.launch({
      args: [
        "dist/electron/main/index.js",
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
      env: appEnv({
        ROMPER_SQUARP_ARCHIVE_URL: pathToFileURL(archive).href,
        ROMPER_USER_DATA_DIR: path.join(tempDir, "user-data"),
      }),
      timeout: 30000,
    });
    // The typed target path makes main ask the user to approve it (RE-03)
    await approveLocalStorePrompts(electronApp);
    const window = await electronApp.firstWindow();

    await window.locator('[data-testid="wizard-source-squarp"]').click();
    await window.locator("#local-store-path-input").fill(store);
    await window.locator('[data-testid="wizard-initialize-btn"]').click();
    await expect(
      window.locator('[data-testid="local-store-wizard"]'),
    ).toHaveCount(0, { timeout: 30000 });

    // In the database, read from the extracted files
    expect(bankNames(store)).toEqual({ A: "ALWIS", D: "RICHARD DEVINE" });

    // Shown at once: bank A's header, and bank D's letter, which has no kits
    await expect(
      window.locator('[data-testid="bank-name-display-A"]'),
    ).toHaveText("ALWIS");
    await expect(
      window.getByRole("button", { name: "Jump to bank D" }),
    ).toHaveAttribute("title", "RICHARD DEVINE");
  });
});
