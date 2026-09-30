import { expect, test } from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright";

import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

/**
 * End-to-End Sync Test with Real File Operations
 *
 * This test exercises the sync confirmation dialog and actual sync workflow
 * using the pre-built E2E fixture which contains:
 * - Two kits (A0, B1) each with 2 WAV samples (1_kick.wav, 2_snare.wav)
 * - A database with sample records referencing those files
 *
 * The fixture extractor points each sample's source_path at the extracted
 * WAV file, so the sync system can find them.
 */
test.describe("Sync Real Operations E2E Tests", () => {
  let electronApp: ReturnType<typeof electron.launch> extends Promise<infer T>
    ? T
    : never;
  let window: Awaited<ReturnType<typeof electronApp.firstWindow>>;
  let testEnv: E2ETestEnvironment;
  let tempSdCardDir: string;

  test.beforeEach(async () => {
    // Use existing fixture system for proper database setup
    testEnv = await extractE2EFixture();

    // Create separate temp SD card directory for sync testing
    tempSdCardDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "romper-sync-sdcard-"),
    );

    console.log(
      `[E2E Sync Test] Using fixture local store: ${testEnv.localStorePath}`,
    );
    console.log(`[E2E Sync Test] Created temp SD card: ${tempSdCardDir}`);

    // Launch Electron app with fixture environment + custom SD card path
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: {
        ...process.env,
        ...testEnv.environment,
        // Override SD card path for isolated testing
        ROMPER_SDCARD_PATH: tempSdCardDir,
      },
      timeout: 30000,
    });

    window = await electronApp.firstWindow();

    // Set up error logging
    window.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error(`[renderer error] ${msg.text()}`);
      }
    });

    // Wait for app to load
    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }

    // Clean up temp SD card directory
    if (tempSdCardDir) {
      await fs.remove(tempSdCardDir);
      console.log(`[E2E Sync Test] Cleaned up temp SD card: ${tempSdCardDir}`);
    }

    // Clean up fixture
    if (testEnv) {
      await cleanupE2EFixture(testEnv);
    }
  });

  test.describe("Full Sync Workflow with Real Files", () => {
    test("should show change summary with actual sample counts and complete sync", async () => {
      // Wait for kit list to be populated
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });

      // Verify test kits are visible
      const kitItems = window.locator('[data-testid^="kit-item-"]');
      const kitCount = await kitItems.count();
      expect(kitCount).toBe(2);
      console.log(`[E2E Sync Test] Found ${kitCount} kits ready for sync`);

      // Open sync dialog
      const syncButton = window.locator('[data-testid="sync-to-sd-card"]');
      await syncButton.waitFor({ state: "visible", timeout: 5000 });
      await syncButton.click();

      // Wait for sync dialog
      await window.waitForSelector('[data-testid="sync-dialog"]', {
        timeout: 5000,
      });

      // Wait for change summary generation to complete
      console.log(
        "[E2E Sync Test] Waiting for sync change summary generation...",
      );

      // The bank summary should appear once the change summary is generated
      const bankSummary = window.locator('[data-testid="bank-summary"]');
      await bankSummary.waitFor({ state: "visible", timeout: 10000 });
      console.log("[E2E Sync Test] Bank summary appeared");

      // Verify the total sample count matches our fixture (4 samples: 2 per kit)
      const totalSamples = window.locator('[data-testid="total-samples"]');
      await expect(totalSamples).toBeVisible();
      const sampleCountText = await totalSamples.textContent();
      expect(Number(sampleCountText)).toBe(4);
      console.log(
        `[E2E Sync Test] Change summary shows ${sampleCountText} samples`,
      );

      // Verify the total kit count
      const totalKits = window.locator('[data-testid="total-kits"]');
      await expect(totalKits).toBeVisible();
      const kitCountText = await totalKits.textContent();
      expect(Number(kitCountText)).toBe(2);

      // Verify bank rows exist for A and B
      await expect(window.locator('[data-testid="bank-A"]')).toBeVisible();
      await expect(window.locator('[data-testid="bank-B"]')).toBeVisible();

      // Verify confirm button is enabled (not disabled) since we have files to sync
      const confirmButton = window.locator('[data-testid="confirm-sync"]');
      await expect(confirmButton).toBeVisible();
      await expect(confirmButton).toBeEnabled();

      // Execute the sync
      console.log("[E2E Sync Test] Starting sync with 4 sample files...");
      await confirmButton.click();

      // Wait for sync to complete - look for the "Write Complete" status
      const writeComplete = window.locator("text=Write Complete");
      await writeComplete.waitFor({ state: "visible", timeout: 15000 });
      console.log("[E2E Sync Test] Sync completed successfully");

      // Verify files were written to the SD card directory
      const sdCardContents = await fs.readdir(tempSdCardDir);
      // Sync should create kit folders on the SD card
      expect(sdCardContents.length).toBeGreaterThan(0);
      console.log(
        `[E2E Sync Test] SD card contents after sync: ${sdCardContents.join(", ")}`,
      );

      // Close the sync dialog
      const closeButton = window.locator('[data-testid="cancel-sync"]');
      await closeButton.click();

      // Wait for dialog to close
      await window.waitForSelector('[data-testid="sync-dialog"]', {
        state: "detached",
        timeout: 3000,
      });

      // Verify we're back to kit list
      await expect(window.locator('[data-testid="kit-grid"]')).toBeVisible();
    });

    test("should handle sync with existing files on SD card correctly", async () => {
      // Pre-populate SD card with some existing kit folders
      await createExistingFilesOnSdCard();

      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });

      // Open sync dialog
      const syncButton = window.locator('[data-testid="sync-to-sd-card"]');
      await syncButton.click();

      await window.waitForSelector('[data-testid="sync-dialog"]', {
        timeout: 5000,
      });

      // Wait for the bank summary to appear (indicates change summary is ready)
      const bankSummary = window.locator('[data-testid="bank-summary"]');
      await bankSummary.waitFor({ state: "visible", timeout: 10000 });

      // The change summary should still show our 4 fixture samples
      const totalSamples = window.locator('[data-testid="total-samples"]');
      const sampleCountText = await totalSamples.textContent();
      expect(Number(sampleCountText)).toBe(4);

      // Confirm button should be enabled
      const confirmButton = window.locator('[data-testid="confirm-sync"]');
      await expect(confirmButton).toBeEnabled();

      // Execute sync with existing files on SD card
      console.log(
        "[E2E Sync Test] Starting sync with existing SD card files...",
      );
      await confirmButton.click();

      // Wait for sync completion
      const writeComplete = window.locator("text=Write Complete");
      await writeComplete.waitFor({ state: "visible", timeout: 15000 });
      console.log(
        "[E2E Sync Test] Sync with existing files completed successfully",
      );

      // Verify the SD card still has content (wasn't wiped since we didn't check the wipe option)
      const sdCardContents = await fs.readdir(tempSdCardDir);
      expect(sdCardContents.length).toBeGreaterThan(0);

      // Close sync dialog
      const closeButton = window.locator('[data-testid="cancel-sync"]');
      await closeButton.click();

      await window.waitForSelector('[data-testid="sync-dialog"]', {
        state: "detached",
        timeout: 3000,
      });

      // Verify we're back to kit list
      await expect(window.locator('[data-testid="kit-grid"]')).toBeVisible();
    });

    test("lists a missing sample and writes the rest only after the user agrees to skip it (RE-09)", async () => {
      await fs.remove(path.join(testEnv.localStorePath, "A0", "1_kick.wav"));

      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      await window.locator('[data-testid="sync-to-sd-card"]').click();

      // The summary lists the missing sample and counts only the other three
      const invalidFiles = window.locator('[data-testid="invalid-files"]');
      await invalidFiles.waitFor({ state: "visible", timeout: 10000 });
      await expect(invalidFiles).toContainText("1 sample can't be written");
      await expect(invalidFiles).toContainText("A0");
      await expect(invalidFiles).toContainText("1_kick.wav");
      await expect(window.locator('[data-testid="total-samples"]')).toHaveText(
        "3",
      );

      // Writing is blocked until the user agrees to skip it
      const confirmButton = window.locator('[data-testid="confirm-sync"]');
      await expect(confirmButton).toBeDisabled();
      await window.locator('label[for="skipInvalidFiles"]').click();
      await expect(confirmButton).toBeEnabled();

      await confirmButton.click();
      await window
        .locator("text=Write Complete")
        .waitFor({ state: "visible", timeout: 15000 });
      await expect(window.locator('[data-testid="skipped-count"]')).toHaveText(
        /1 skipped/,
      );

      // The missing sample was skipped; everything else was written
      expect(
        await fs.pathExists(path.join(tempSdCardDir, "A0", "1", "1_kick.wav")),
      ).toBe(false);
      expect(
        await fs.pathExists(path.join(tempSdCardDir, "B1", "1", "1_kick.wav")),
      ).toBe(true);
    });
  });

  /**
   * Create some existing files on SD card to test sync with pre-existing content
   */
  async function createExistingFilesOnSdCard() {
    console.log("[E2E Sync Test] Creating existing files on SD card...");

    // Create existing kit folders with dummy files to simulate a previously-synced SD card
    const existingKitDir = path.join(tempSdCardDir, "A0");
    await fs.ensureDir(existingKitDir);

    // Create a minimal WAV file header (44 bytes RIFF/WAVE header + minimal data)
    const wavHeader = Buffer.alloc(48, 0);
    wavHeader.write("RIFF", 0, 4, "ascii");
    wavHeader.writeUInt32LE(40, 4); // file size - 8
    wavHeader.write("WAVE", 8, 4, "ascii");
    wavHeader.write("fmt ", 12, 4, "ascii");
    wavHeader.writeUInt32LE(16, 16); // subchunk1 size
    wavHeader.writeUInt16LE(1, 20); // PCM format
    wavHeader.writeUInt16LE(1, 22); // mono
    wavHeader.writeUInt32LE(44100, 24); // sample rate
    wavHeader.writeUInt32LE(88200, 28); // byte rate
    wavHeader.writeUInt16LE(2, 32); // block align
    wavHeader.writeUInt16LE(16, 34); // bits per sample
    wavHeader.write("data", 36, 4, "ascii");
    wavHeader.writeUInt32LE(4, 40); // data size

    await fs.writeFile(path.join(existingKitDir, "SP-01-001.wav"), wavHeader);

    console.log("[E2E Sync Test] Created existing SD card content in A0/");
  }
});
