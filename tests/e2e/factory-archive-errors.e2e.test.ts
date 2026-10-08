import { _electron as electron } from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { appEnv } from "../utils/e2e-app-env";
import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { expect, test } from "../utils/e2e-error-guard";
import { generatedFactoryArchive } from "../utils/generated-library";

// RE-77: a factory archive that arrived damaged was downloaded three times,
// then reported as a generic "check your internet connection" error. The
// wizard now shows main's reason at once.
test.describe("[UC-02] A damaged factory archive", () => {
  test.use({
    expectedMessages: {
      "the test installs a damaged factory archive": {
        pattern: /The factory sample archive couldn't be unpacked/,
        sources: ["ui", "renderer-console"],
      },
      "the test starts with no local store, so the wizard opens": {
        pattern: /No local store configured/,
        sources: ["main-stdout"],
      },
    },
  });

  let tempDir: string;

  test.beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-damaged-"));
  });

  test.afterEach(async () => {
    await fs.remove(tempDir).catch(() => {});
  });

  test("shows why setup failed, without retrying it as a network error", async () => {
    // A factory archive, cut short
    const archive = generatedFactoryArchive();
    const damaged = path.join(tempDir, "squarp-damaged.zip");
    await fs.writeFile(
      damaged,
      archive.subarray(0, Math.floor(archive.length / 2)),
    );

    const electronApp = await electron.launch({
      args: [
        "dist/electron/main/index.js",
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
      env: appEnv({
        ROMPER_SQUARP_ARCHIVE_URL: pathToFileURL(damaged).href,
        ROMPER_USER_DATA_DIR: path.join(tempDir, "user-data"),
      }),
      timeout: 30000,
    });
    // The typed target path makes main ask the user to approve it (RE-03)
    await approveLocalStorePrompts(electronApp);

    try {
      const window = await electronApp.firstWindow();
      await window.waitForSelector('[data-testid="wizard-source-squarp"]', {
        state: "visible",
        timeout: 10000,
      });
      await window.click('[data-testid="wizard-source-squarp"]');
      await window.fill("#local-store-path-input", path.join(tempDir, "store"));
      await window.click('[data-testid="wizard-initialize-btn"]');

      const error = window.locator('[data-testid="wizard-error"]');
      await expect(error).toBeVisible({ timeout: 10000 });
      // Main's reason as it is: not wrapped in the retry loop's
      // "failed after 3 attempts", and not a network error
      await expect(error).toHaveText(
        /^The factory sample archive couldn't be unpacked: /,
      );
      await expect(error).not.toContainText("attempts");
      await expect(error).not.toContainText("internet connection");
      // The wizard stays open, so the user can choose another source
      await expect(
        window.locator('[data-testid="local-store-wizard"]'),
      ).toBeVisible();
    } finally {
      await electronApp.close();
    }
  });
});
