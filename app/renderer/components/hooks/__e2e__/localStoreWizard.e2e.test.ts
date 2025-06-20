// E2E test for Local Store Wizard flows using Playwright (or Spectron, or Electron E2E harness)
// This is a scaffold. You must run this in an environment where the Electron renderer UI is available.

import type { ElectronApplication, Page } from "@playwright/test";
import { _electron as electron, expect, test } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

// Helper function to verify database using Electron's Node.js
async function verifyDatabaseWithElectronNode(dbPath: string) {
  return new Promise((resolve, reject) => {
    const verifierScript = path.resolve(
      process.cwd(),
      "tests/e2e/verify-db-with-electron.mjs",
    );

    const child = spawn("node", [verifierScript, dbPath], {
      stdio: "pipe",
    });

    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      console.error("Verification stderr:", data.toString());
    });

    child.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse verification result: ${output}`));
        }
      } else {
        reject(
          new Error(
            `Verification process exited with code ${code}. Output: ${output}`,
          ),
        );
      }
    });
  });
}

async function runWizardTest(
  {
    source,
    fixturePath,
    squarpArchiveUrl,
  }: {
    source: "sdcard" | "squarp" | "blank";
    fixturePath?: string;
    squarpArchiveUrl?: string;
  },
  testName?: string,
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
      ROMPER_E2E_TARGET_PATH: path.join(
        process.env.ROMPER_E2E_TMPDIR || "/tmp",
        `romper-e2e-${source}-${Date.now()}`,
      ),
    }).filter(([_, v]) => typeof v === "string"),
  ) as { [key: string]: string };
  
  // Enhanced logging for debugging
  console.log(`[${testName || "E2E"}] Launching Electron with env:`, Object.keys(env));
  console.log(`[${testName || "E2E"}] Working directory:`, process.cwd());
  console.log(`[${testName || "E2E"}] Checking if main file exists...`);
  
  const mainFile = path.resolve("dist/electron/main/index.js");
  if (!fs.existsSync(mainFile)) {
    throw new Error(`Main file does not exist: ${mainFile}`);
  }
  console.log(`[${testName || "E2E"}] Main file exists: ${mainFile}`);
  
  const electronApp = await electron.launch({
    args: [
      "dist/electron/main/index.js",
      ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
    ],
    env,
    timeout: 30000, // 30 second timeout
  }).catch(error => {
    console.error(`[${testName || "E2E"}] Failed to launch Electron:`, error);
    throw error;
  });

  const window = await electronApp.firstWindow();

  // Restore renderer log listener
  window.on("console", (msg) => {
    for (let i = 0; i < msg.args().length; ++i)
      console.log(`[${testName || "E2E"}] [renderer log] ${msg.args()[i]}`);
  });

  await window.waitForSelector('button[aria-label="Local Store Setup"]', {
    state: "visible",
  });
  await window.click('button[aria-label="Local Store Setup"]');
  await window.screenshot({ path: "after-local-store-setup-click.png" });
  const htmlAfterClick = await window.content();
  await window.waitForSelector('[data-testid="local-store-wizard"]');

  // 1. source
  const sourceSelector = `[data-testid="wizard-source-${source}"]`;
  await window.waitForSelector(sourceSelector, { state: "visible" });
  await window.click(sourceSelector);

  // 1.5 Check the source URL, which is source dependent
  const sourceNameLabel = await window.textContent(
    '[data-testid="wizard-source-name"]',
  );
  let sourceUrlLabel: string | null = null;
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

  // 2. target
  const targetPath = env.ROMPER_E2E_TARGET_PATH;
  await window.waitForSelector("#local-store-path-input", { state: "visible" });
  await window.fill("#local-store-path-input", targetPath);

  // 3. initialize
  // Wait for the initialize button to become enabled
  await window.waitForFunction(() => {
    const btn = document.querySelector('[data-testid="wizard-initialize-btn"]');
    return btn && !(btn as HTMLButtonElement).disabled;
  });

  // Initialize to kick off the import
  await window.click('[data-testid="wizard-initialize-btn"]');
  await window.waitForSelector("text=Local store initialized successfully!", {
    timeout: 10000,
  });

  // Assert that the db exists
  const dbPath = path.join(targetPath, ".romperdb", "romper.sqlite");
  console.log("Romper DB path: " + dbPath);
  await waitForFileExists(dbPath);
  expect(await fs.pathExists(dbPath)).toBe(true);

  // Verify database structure and contents
  await verifyDatabase(dbPath, source);

  await electronApp.close();
}

// Verify database structure and contents based on source type
async function verifyDatabase(
  dbPath: string,
  source: "sdcard" | "squarp" | "blank",
) {
  try {
    // Use Electron's Node.js to verify database with correct better-sqlite3 binary
    const result = (await verifyDatabaseWithElectronNode(dbPath)) as any;

    if (!result.success) {
      throw new Error(`Database verification failed: ${result.error}`);
    }

    // Check that required tables exist
    expect(result.tables).toContain("kits");
    expect(result.tables).toContain("samples");

    // Verify contents based on source type
    if (source === "blank") {
      // Blank source should have no kits or samples
      expect(result.kits).toBe(0);
      expect(result.samples).toBe(0);
    } else if (source === "sdcard" || source === "squarp") {
      // Both sources should have A0 and B1 kits with samples
      expect(result.kits).toBe(2);
      expect(result.samples).toBe(4); // 2 samples per kit * 2 kits
    }

    console.log(`Database verification passed for ${source} source:`, {
      tables: result.tables.length,
      kits: result.kits,
      samples: result.samples,
    });
  } catch (error) {
    console.error(`Database verification failed for ${source} source:`, error);
    throw error;
  }
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
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  test("can initialize from SD card fixture via UI", async () => {
    const sdcardPath = path.resolve(
      __dirname,
      "../../../../../tests/fixtures/sdcard",
    );
    await runWizardTest({ source: "sdcard", fixturePath: sdcardPath });
  });

  test("can initialize from Squarp.net archive fixture via UI", async () => {
    // Use a local fixture zip for the Squarp archive in E2E
    const fixtureSquarpZip = path.resolve(
      __dirname,
      "../../../../../tests/fixtures/squarp.zip",
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
