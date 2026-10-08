// E2E test for Local Store Wizard flows using Playwright (or Spectron, or Electron E2E harness)
// This is a scaffold. You must run this in an environment where the Electron renderer UI is available.

import { _electron as electron } from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  approveLocalStorePrompts,
  getLocalStorePromptsShown,
} from "../../../../../../tests/utils/e2e-dialogs";
import { expect, test } from "../../../../../../tests/utils/e2e-error-guard";
import {
  expectedImport,
  generatedFactoryArchive,
  readImport,
  writeGeneratedCard,
} from "../../../../../../tests/utils/generated-library";

// Retry a function with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries - 1) break;

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError || new Error("All retry attempts failed");
}

/**
 * Run the wizard from `source` into a new folder, and return that folder.
 * The SD card and the factory archive hold the generated library
 * (tests/utils/generated-library.ts): real WAV audio, mono and stereo.
 */
async function runWizardTest(
  source: "blank" | "sdcard" | "squarp",
  tempDir: string,
  testName?: string,
): Promise<string> {
  let fixturePath: string | undefined;
  let squarpArchiveUrl: string | undefined;
  if (source === "sdcard") {
    fixturePath = path.join(tempDir, "card");
    await writeGeneratedCard(fixturePath);
  } else if (source === "squarp") {
    const archive = path.join(tempDir, "factory.zip");
    await fs.writeFile(archive, generatedFactoryArchive());
    squarpArchiveUrl = pathToFileURL(archive).href;
  }

  // Its own settings, so no earlier launch's saved store stops the wizard
  // from opening
  const userData = path.join(tempDir, "user-data");
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      ROMPER_USER_DATA_DIR: userData,
      ...(source === "sdcard" && fixturePath
        ? { ROMPER_SDCARD_PATH: fixturePath }
        : {}),
      ...(source === "squarp" && squarpArchiveUrl
        ? { ROMPER_SQUARP_ARCHIVE_URL: squarpArchiveUrl }
        : {}),
    }).filter(([_, v]) => typeof v === "string"),
  ) as { [key: string]: string };

  // Enhanced logging for debugging
  console.log(
    `[${testName || "E2E"}] Launching Electron with env:`,
    Object.keys(env),
  );
  console.log(`[${testName || "E2E"}] Working directory:`, process.cwd());
  console.log(`[${testName || "E2E"}] Checking if main file exists...`);

  const mainFile = path.resolve("dist/electron/main/index.js");
  if (!fs.existsSync(mainFile)) {
    throw new Error(`Main file does not exist: ${mainFile}`);
  }
  console.log(`[${testName || "E2E"}] Main file exists: ${mainFile}`);

  const electronApp = await retryWithBackoff(async () => {
    return await electron.launch({
      args: [
        "dist/electron/main/index.js",
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
      env,
      timeout: 30000, // 30 second timeout
    });
  }).catch((error) => {
    console.error(
      `[${testName || "E2E"}] Failed to launch Electron after retries:`,
      error,
    );
    throw error;
  });

  const window = await retryWithBackoff(async () => {
    const win = await electronApp.firstWindow();

    // Wait for window to be ready for interaction
    await win.waitForLoadState("domcontentloaded");

    return win;
  });

  // The typed target path below makes main ask the user to approve it (RE-03)
  await approveLocalStorePrompts(electronApp);

  // Restore renderer log listener
  window.on("console", (msg) => {
    for (let i = 0; i < msg.args().length; ++i)
      console.log(`[${testName || "E2E"}] [renderer log] ${msg.args()[i]}`);
  });

  // Wait for the wizard to auto-open and be fully loaded
  await retryWithBackoff(async () => {
    await window.waitForSelector('[data-testid="local-store-wizard"]', {
      state: "visible",
      timeout: 5000,
    });

    // Ensure wizard is interactive by checking for source selection buttons
    await window.waitForSelector('[data-testid="wizard-source-blank"]', {
      state: "visible",
      timeout: 2000,
    });
  });

  // 1. source
  const sourceSelector = `[data-testid="wizard-source-${source}"]`;
  await window.waitForSelector(sourceSelector, { state: "visible" });
  await window.click(sourceSelector);

  // 1.5 Check the source URL, which is source dependent
  const sourceNameLabel = await window.textContent(
    '[data-testid="wizard-source-name"]',
  );
  let sourceUrlLabel: null | string = null;
  if (source === "blank") {
    // For blank, the source URL label should not be present in the DOM
    const sourceUrlElem = await window.$('[data-testid="wizard-source-url"]');
    expect(sourceUrlElem).toBeNull();
  } else {
    sourceUrlLabel = await window.textContent(
      '[data-testid="wizard-source-url"]',
    );
    if (source === "squarp") {
      expect(sourceNameLabel).toContain("Squarp.net Factory Samples");
      expect(sourceUrlLabel).toContain(squarpArchiveUrl);
    } else if (source === "sdcard") {
      expect(sourceNameLabel).toContain("Rample SD Card");
      expect(sourceUrlLabel).toContain(fixturePath);
    }
  }

  // 2. target: a new folder, since no store is configured
  const targetPath = path.join(tempDir, `romper-e2e-${source}`);
  await window.waitForSelector("#local-store-path-input", { state: "visible" });
  await window.fill("#local-store-path-input", targetPath);

  // 3. initialize
  // Wait for the initialize button to be present and click it
  await window.waitForSelector('[data-testid="wizard-initialize-btn"]', {
    state: "visible",
    timeout: 10000,
  });

  // Initialize to kick off the import
  await window.click('[data-testid="wizard-initialize-btn"]');

  // Wait for either success (wizard disappears or post-init guidance shown) or failure (error appears)
  await Promise.race([
    // Success path: wizard disappears
    window.waitForSelector('[data-testid="local-store-wizard"]', {
      state: "hidden",
      timeout: 30000,
    }),
    // Success path: post-init guidance shown (blank folder or truncation warnings)
    window
      .waitForSelector('[data-testid="wizard-post-init-guidance"]', {
        state: "visible",
        timeout: 30000,
      })
      .then(async () => {
        // Click continue to dismiss guidance and proceed
        await window.click('[data-testid="post-init-continue-btn"]');
        await window.waitForSelector('[data-testid="local-store-wizard"]', {
          state: "hidden",
          timeout: 10000,
        });
      }),
    // Failure path: error message appears
    window
      .waitForSelector('[data-testid="wizard-error"]', {
        state: "visible",
        timeout: 30000,
      })
      .then(async () => {
        const errorText = await window.textContent(
          '[data-testid="wizard-error"]',
        );
        throw new Error(`Wizard initialization failed: ${errorText}`);
      }),
  ]);

  // Main asked the user to approve the typed folder before writing to it
  expect(await getLocalStorePromptsShown(electronApp)).toEqual([targetPath]);

  // Assert that the db exists
  const dbPath = path.join(targetPath, ".romperdb", "romper.sqlite");
  console.log("Romper DB path: " + dbPath);
  await waitForFileExists(dbPath);
  expect(await fs.pathExists(dbPath)).toBe(true);

  await electronApp.close();
  return targetPath;
}

// Wait for a file to exist (polling, idiomatic for Playwright E2E)
async function waitForFileExists(
  filePath: string,
  timeoutMs = 5000,
  intervalMs = 100,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`File did not exist after ${timeoutMs}ms: ${filePath}`);
}

test.describe("Local Store Wizard E2E", () => {
  test.use({
    expectedMessages: {
      "each run starts with no local store, so the wizard opens": {
        pattern: /No local store configured/,
        sources: ["main-stdout"],
      },
    },
  });

  let tempDir: string;

  test.beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-wizard-"));
  });

  test.afterEach(async () => {
    await fs.remove(tempDir).catch(() => {});
  });

  // RE-67: setup is checked by what it imported, not by the database
  // existing: every kit, every sample in its voice and slot, each file
  // byte for byte, the stereo pair linked and the bank named.

  test("[UC-01] [Q-07] imports an SD card's kits and samples via UI", async () => {
    const store = await runWizardTest("sdcard", tempDir);
    expect(await readImport(store)).toEqual(expectedImport());
  });

  test("[UC-02] [Q-07] imports the factory archive's kits and samples via UI", async () => {
    const store = await runWizardTest("squarp", tempDir);
    expect(await readImport(store)).toEqual(expectedImport());
  });

  test("[UC-03] can initialize blank folder via UI", async ({}, testInfo) => {
    const store = await runWizardTest("blank", tempDir, testInfo.title);
    expect(await readImport(store)).toEqual({
      banks: {},
      kits: [],
      linkedVoices: [],
      samples: [],
    });
  });
});
