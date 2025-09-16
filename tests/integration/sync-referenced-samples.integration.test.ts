import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Electron's BrowserWindow to prevent getAllWindows error
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import {
  addKit,
  addSample,
  createRomperDbFile,
  getKitSamples,
} from "../../electron/main/db/romperDbCoreORM.js";
import { syncService } from "../../electron/main/services/syncService.js";

describe("Sync Referenced Samples Integration Test", () => {
  let tempDir: string;
  let localStorePath: string;
  let sdCardPath: string;
  let dbDir: string;
  let externalSamplePath: string;

  beforeEach(() => {
    // Create temporary directories
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));
    localStorePath = path.join(tempDir, "local-store");
    sdCardPath = path.join(tempDir, "sd-card");
    dbDir = path.join(localStorePath, ".romperdb");

    // Create directory structure
    fs.mkdirSync(localStorePath, { recursive: true });
    fs.mkdirSync(sdCardPath, { recursive: true });

    // Create database
    createRomperDbFile(dbDir);

    // Create an external sample file (outside local store)
    const externalDir = path.join(tempDir, "external-samples");
    fs.mkdirSync(externalDir, { recursive: true });
    externalSamplePath = path.join(externalDir, "kick.wav");

    // Create a minimal WAV file for testing
    const wavHeader = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x10, 0x00, 0x00]), // File size
      Buffer.from("WAVE", "ascii"),
      Buffer.from("fmt ", "ascii"),
      Buffer.from([0x10, 0x00, 0x00, 0x00]), // Subchunk size
      Buffer.from([0x01, 0x00]), // Audio format (PCM)
      Buffer.from([0x01, 0x00]), // Number of channels (1 = mono)
      Buffer.from([0x44, 0xac, 0x00, 0x00]), // Sample rate (44100)
      Buffer.from([0x88, 0x58, 0x01, 0x00]), // Byte rate
      Buffer.from([0x02, 0x00]), // Block align
      Buffer.from([0x10, 0x00]), // Bits per sample
      Buffer.from("data", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // Data size
    ]);
    fs.writeFileSync(externalSamplePath, wavHeader);
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(tempDir, { force: true, recursive: true });
    vi.clearAllMocks();
  });

  it("should sync kits with only referenced samples (reproduces bug)", async () => {
    // Step 1: Create an empty editable kit (simulates user creating new kit)
    const kitName = "A7";
    const addKitResult = addKit(dbDir, {
      alias: "Test Kit",
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: kitName,
      step_pattern: null,
    });
    expect(addKitResult.success).toBe(true);

    // Step 2: Add external sample via drag-and-drop (simulates user action)
    const addSampleResult = addSample(dbDir, {
      filename: "kick.wav",
      is_stereo: false,
      kit_name: kitName,
      slot_number: 0,
      source_path: externalSamplePath, // External reference
      voice_number: 1,
    });
    expect(addSampleResult.success).toBe(true);

    // Verify sample was added correctly with source_path
    const samplesResult = getKitSamples(dbDir, kitName);
    expect(samplesResult.success).toBe(true);
    expect(samplesResult.data).toHaveLength(1);
    expect(samplesResult.data![0].source_path).toBe(externalSamplePath);

    // Step 3: Perform sync (reproduces the bug)
    const inMemorySettings = {
      localStorePath,
    };

    // First generate change summary to verify kit is detected
    const summaryResult = await syncService.generateChangeSummary(
      inMemorySettings,
      sdCardPath,
    );

    expect(summaryResult.success).toBe(true);
    expect(summaryResult.data?.kitCount).toBe(1);
    expect(summaryResult.data?.fileCount).toBe(1);

    // Now perform the actual sync
    const syncResult = await syncService.startKitSync(inMemorySettings, {
      sdCardPath,
      wipeSdCard: false,
    });

    // This is where the bug manifests - the sync should succeed
    if (!syncResult.success) {
      console.error("Sync failed with error:", syncResult.error);
    }
    expect(syncResult.success).toBe(true);
    expect(syncResult.data?.syncedFiles).toBe(1);

    // Verify the kit folder was created on SD card
    const expectedKitDir = path.join(sdCardPath, kitName);
    expect(fs.existsSync(expectedKitDir)).toBe(true);

    // Verify the sample was copied to the correct location
    const expectedSamplePath = path.join(expectedKitDir, "1", "kick.wav");
    expect(fs.existsSync(expectedSamplePath)).toBe(true);
  });

  it("should sync kits with mix of local and referenced samples", async () => {
    const kitName = "B3";

    // Create kit
    addKit(dbDir, {
      alias: "Mixed Kit",
      bank_letter: "B",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: kitName,
      step_pattern: null,
    });

    // Add external referenced sample
    addSample(dbDir, {
      filename: "kick.wav",
      is_stereo: false,
      kit_name: kitName,
      slot_number: 0,
      source_path: externalSamplePath,
      voice_number: 1,
    });

    // Create and add local store sample
    const localKitDir = path.join(localStorePath, kitName);
    fs.mkdirSync(localKitDir, { recursive: true });
    const localSamplePath = path.join(localKitDir, "snare.wav");
    fs.copyFileSync(externalSamplePath, localSamplePath); // Copy WAV for testing

    addSample(dbDir, {
      filename: "snare.wav",
      is_stereo: false,
      kit_name: kitName,
      slot_number: 0,
      source_path: localSamplePath,
      voice_number: 2,
    });

    // Perform sync
    const inMemorySettings = { localStorePath };
    const syncResult = await syncService.startKitSync(inMemorySettings, {
      sdCardPath,
      wipeSdCard: false,
    });

    expect(syncResult.success).toBe(true);
    expect(syncResult.data?.syncedFiles).toBe(2);

    // Verify both samples were synced
    expect(fs.existsSync(path.join(sdCardPath, kitName, "1", "kick.wav"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(sdCardPath, kitName, "2", "snare.wav")),
    ).toBe(true);
  });

  it("should not sync truly empty kits (no samples at all)", async () => {
    // Create an empty kit with no samples
    const kitName = "C0";
    addKit(dbDir, {
      alias: "Empty Kit",
      bank_letter: "C",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: kitName,
      step_pattern: null,
    });

    // Verify no samples exist
    const samplesResult = getKitSamples(dbDir, kitName);
    expect(samplesResult.success).toBe(true);
    expect(samplesResult.data).toHaveLength(0);

    // Perform sync
    const inMemorySettings = { localStorePath };
    const syncResult = await syncService.startKitSync(inMemorySettings, {
      sdCardPath,
      wipeSdCard: false,
    });

    // Should succeed but with 0 files synced
    expect(syncResult.success).toBe(true);
    expect(syncResult.data?.syncedFiles).toBe(0);

    // Kit directory should NOT be created for truly empty kit
    const kitDir = path.join(sdCardPath, kitName);
    expect(fs.existsSync(kitDir)).toBe(false);
  });

  it("should handle missing source files gracefully", async () => {
    const kitName = "D5";

    // Create kit
    addKit(dbDir, {
      alias: "Test Kit",
      bank_letter: "D",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: kitName,
      step_pattern: null,
    });

    // Add sample with non-existent source path
    const nonExistentPath = path.join(tempDir, "missing.wav");
    addSample(dbDir, {
      filename: "missing.wav",
      is_stereo: false,
      kit_name: kitName,
      slot_number: 0,
      source_path: nonExistentPath,
      voice_number: 1,
    });

    // Also add a valid sample
    addSample(dbDir, {
      filename: "kick.wav",
      is_stereo: false,
      kit_name: kitName,
      slot_number: 0,
      source_path: externalSamplePath,
      voice_number: 2,
    });

    // Perform sync
    const inMemorySettings = { localStorePath };
    const syncResult = await syncService.startKitSync(inMemorySettings, {
      sdCardPath,
      wipeSdCard: false,
    });

    // Should sync the valid sample but skip the missing one
    expect(syncResult.success).toBe(true);
    expect(syncResult.data?.syncedFiles).toBe(1);

    // Only the valid sample should be synced
    expect(fs.existsSync(path.join(sdCardPath, kitName, "2", "kick.wav"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(sdCardPath, kitName, "1", "missing.wav")),
    ).toBe(false);
  });
});
