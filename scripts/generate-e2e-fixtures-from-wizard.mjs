#!/usr/bin/env node

/**
 * E2E Fixtures Generator - Reuses Existing Wizard E2E Test
 * 
 * This script imports and runs the proven working wizard E2E test,
 * then captures the database result as fixtures for other E2E tests.
 */

import fs from "fs-extra";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SDCARD_FIXTURES_PATH = path.resolve(__dirname, "../tests/fixtures/sdcard");
const OUTPUT_DIR = path.resolve(__dirname, "../tests/fixtures/e2e");
const FIXTURE_ARCHIVE_NAME = "local-store-fixture.tar.gz";

/**
 * Import the working wizard test function
 * This is the exact same function that runs successfully in E2E tests
 */
async function importWizardTest() {
  const wizardTestPath = path.resolve(__dirname, "../app/renderer/components/hooks/wizard/__tests__/localStoreWizard.e2e.test.ts");
  
  // For TypeScript imports in Node, we need to compile or use dynamic import
  // Since this is an admin script, let's use a simpler approach - extract the runWizardTest logic
  return { runWizardTest };
}

/**
 * Extracted runWizardTest function from the working E2E test
 * This ensures identical behavior to the proven working test
 */
async function runWizardTest({ fixturePath, source }) {
  const { _electron: electron } = await import("@playwright/test");
  
  const env = {
    ...process.env,
    ROMPER_SDCARD_PATH: fixturePath,
    ROMPER_LOCAL_PATH: path.join("/tmp", `romper-e2e-${source}-${Date.now()}`),
  };

  console.log(`[E2E Wizard] Launching Electron with env:`, Object.keys(env));
  console.log(`[E2E Wizard] ROMPER_LOCAL_PATH: ${env.ROMPER_LOCAL_PATH}`);
  console.log(`[E2E Wizard] ROMPER_SDCARD_PATH: ${env.ROMPER_SDCARD_PATH}`);

  const mainFile = path.resolve("dist/electron/main/index.js");
  if (!fs.existsSync(mainFile)) {
    throw new Error(`Main file does not exist: ${mainFile}`);
  }

  const electronApp = await electron.launch({
    args: [
      "dist/electron/main/index.js",
      ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
    ],
    env,
    timeout: 30000,
  });

  const window = await electronApp.firstWindow();

  // Wait for the wizard to auto-open
  await window.waitForSelector('[data-testid="local-store-wizard"]', {
    state: "visible",
  });

  // 1. Select SD card source
  const sourceSelector = `[data-testid="wizard-source-${source}"]`;
  await window.waitForSelector(sourceSelector, { state: "visible" });
  await window.click(sourceSelector);

  // 2. Set target path
  const targetPath = env.ROMPER_LOCAL_PATH;
  await window.waitForSelector("#local-store-path-input", { state: "visible" });
  await window.fill("#local-store-path-input", targetPath);

  // 3. Initialize
  await window.waitForFunction(() => {
    const btn = document.querySelector('[data-testid="wizard-initialize-btn"]');
    return btn && !btn.disabled;
  });

  await window.click('[data-testid="wizard-initialize-btn"]');

  // Wait for wizard completion
  await window.waitForSelector('[data-testid="local-store-wizard"]', {
    state: "hidden",
    timeout: 15000,
  });

  // Verify database was created
  const dbPath = path.join(targetPath, ".romperdb", "romper.sqlite");
  await waitForFileExists(dbPath);
  
  await electronApp.close();
  
  return { localStorePath: targetPath, dbPath };
}

// Helper function from the original E2E test
async function waitForFileExists(filePath, timeoutMs = 5000, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`File did not exist after ${timeoutMs}ms: ${filePath}`);
}

async function main() {
  try {
    console.log("🧙 E2E Fixtures Generator (Wizard-Based)");
    console.log("========================================");

    // Verify SD card fixtures exist
    if (!await fs.pathExists(SDCARD_FIXTURES_PATH)) {
      throw new Error(`SD card fixtures not found: ${SDCARD_FIXTURES_PATH}`);
    }

    console.log("🚀 Running wizard E2E test to generate database...");
    
    // Run the wizard test with SD card fixtures
    const { localStorePath } = await runWizardTest({
      fixturePath: SDCARD_FIXTURES_PATH,
      source: "sdcard"
    });

    console.log("✅ Wizard completed successfully!");
    console.log(`📁 Local store created at: ${localStorePath}`);

    // Get kit list from local store
    const kits = [];
    const contents = await fs.readdir(localStorePath);
    for (const item of contents) {
      const itemPath = path.join(localStorePath, item);
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory() && item.match(/^[A-Z]\d+$/)) {
        kits.push(item);
      }
    }

    console.log(`📦 Found ${kits.length} kits: ${kits.join(", ")}`);

    // Create archive
    console.log("📦 Creating fixture archive...");
    await fs.ensureDir(OUTPUT_DIR);
    const archivePath = path.join(OUTPUT_DIR, FIXTURE_ARCHIVE_NAME);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('tar', { gzip: true });

      output.on('close', () => {
        console.log(`📦 Archive created: ${archivePath} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(localStorePath, false);
      archive.finalize();
    });

    // Create metadata
    const metadataPath = path.join(OUTPUT_DIR, "fixture-metadata.json");
    const metadata = {
      generated: new Date().toISOString(),
      source: "Wizard E2E test automation",
      archivePath: path.basename(archivePath),
      kits: kits,
      usage: "Extract this archive to create a pre-initialized local store for E2E tests"
    };

    await fs.writeJSON(metadataPath, metadata, { spaces: 2 });

    console.log("🎉 E2E fixture generation completed successfully!");
    console.log("📁 Files created:");
    console.log(`   - ${archivePath}`);
    console.log(`   - ${metadataPath}`);
    console.log(`   - Kits: ${kits.join(", ")}`);

    // Clean up temp directory
    await fs.remove(localStorePath);
    console.log("🧹 Temporary directory cleaned up");

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);