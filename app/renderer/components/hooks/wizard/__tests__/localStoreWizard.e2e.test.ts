// E2E test for Local Store Wizard flows using Playwright (or Spectron, or Electron E2E harness)
// This is a scaffold. You must run this in an environment where the Electron renderer UI is available.

import { _electron as electron, expect, test } from "@playwright/test";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

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

async function runWizardTest(
  {
    fixturePath,
    source,
    squarpArchiveUrl,
  }: {
    fixturePath?: string;
    source: "blank" | "sdcard" | "squarp";
    squarpArchiveUrl?: string;
  },
  testName?: string
) {
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      ...(source === "sdcard" && fixturePath
        ? { ROMPER_SDCARD_PATH: fixturePath }
        : {}),
      ...(source === "squarp" && squarpArchiveUrl
        ? { ROMPER_SQUARP_ARCHIVE_URL: squarpArchiveUrl }
        : {}),
      ROMPER_LOCAL_PATH: "", // Empty string triggers wizard (no local store override)
    }).filter(([_, v]) => typeof v === "string")
  ) as { [key: string]: string };

  // Enhanced logging for debugging
  console.log(
    `[${testName || "E2E"}] Launching Electron with env:`,
    Object.keys(env)
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
    '[data-testid="wizard-source-name"]'
  );
  let sourceUrlLabel: null | string = null;
  if (source === "blank") {
    // For blank, the source URL label should not be present in the DOM
    const sourceUrlElem = await window.$('[data-testid="wizard-source-url"]');
    expect(sourceUrlElem).toBeNull();
  } else {
    sourceUrlLabel = await window.textContent(
      '[data-testid="wizard-source-url"]'
    );
    if (source === "squarp") {
      expect(sourceNameLabel).toContain("Squarp.net Factory Samples");
      expect(sourceUrlLabel).toContain(squarpArchiveUrl);
    } else if (source === "sdcard") {
      expect(sourceNameLabel).toContain("Rample SD Card");
      expect(sourceUrlLabel).toContain(fixturePath);
    }
  }

  // 2. target - generate dynamic path since ROMPER_LOCAL_PATH is empty
  const targetPath = path.join("/tmp", `romper-e2e-${source}-${Date.now()}`);
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

  // Wait for either success (wizard disappears) or failure (error appears)
  await Promise.race([
    // Success path: wizard disappears
    window.waitForSelector('[data-testid="local-store-wizard"]', {
      state: "hidden",
      timeout: 15000,
    }),
    // Failure path: error message appears
    window
      .waitForSelector('[data-testid="wizard-error"]', {
        state: "visible",
        timeout: 15000,
      })
      .then(async () => {
        const errorText = await window.textContent(
          '[data-testid="wizard-error"]',
        );
        throw new Error(`Wizard initialization failed: ${errorText}`);
      }),
  ]);

  // Assert that the db exists
  const dbPath = path.join(targetPath, ".romperdb", "romper.sqlite");
  console.log("Romper DB path: " + dbPath);
  await waitForFileExists(dbPath);
  expect(await fs.pathExists(dbPath)).toBe(true);

  await electronApp.close();
}

// Wait for a file to exist (polling, idiomatic for Playwright E2E)
async function waitForFileExists(
  filePath: string,
  timeoutMs = 5000,
  intervalMs = 100
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`File did not exist after ${timeoutMs}ms: ${filePath}`);
}

test.describe("Local Store Wizard E2E", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  test("can initialize from SD card fixture via UI", async () => {
    const sdcardPath = path.resolve(
      __dirname,
      "../../../../../../tests/fixtures/sdcard"
    );
    await runWizardTest({ fixturePath: sdcardPath, source: "sdcard" });
  });

  test("can initialize from Squarp.net archive fixture via UI", async () => {
    // Use a local fixture zip for the Squarp archive in E2E
    const fixtureSquarpZip = path.resolve(
      __dirname,
      "../../../../../../tests/fixtures/squarp.zip"
    );
    const squarpArchiveUrl = `file://${fixtureSquarpZip}`;
    await runWizardTest({
      source: "squarp",
      squarpArchiveUrl,
    });
  });

  test("can initialize blank folder via UI", async ({}, testInfo) => {
    const testName = testInfo.title;
    await runWizardTest({ source: "blank" }, testName);
  });
});
