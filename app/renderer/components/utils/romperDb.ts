// Handles Romper DB (SQLite) operations for plans, kits, and samples.
// This is a stub for initial DB creation logic for 2.2

import type { NewKit } from "@romper/shared/db/schema.js";

export async function createRomperDb(dbDir: string) {
  if (!window.electronAPI?.createRomperDb) {
    console.error("[Renderer] Romper DB creation not available");
    throw new Error("Romper DB creation not available");
  }
  const result = await window.electronAPI.createRomperDb(dbDir);
  if (!result.success) {
    console.error("[Renderer] Failed to create Romper DB:", result.error);
    throw new Error(result.error || "Failed to create Romper DB");
  }
  console.log("[Renderer] Romper DB created at:", result.dbPath);
  return result.dbPath;
}

export async function insertKit(dbDir: string, kit: NewKit) {
  if (!window.electronAPI?.insertKit) throw new Error("IPC not available");

  const result = await window.electronAPI.insertKit(dbDir, kit);
  if (!result.success) throw new Error(result.error || "Failed to insert kit");
  return kit.name; // Return the kit name instead of an ID
}

export async function insertSample(
  dbDir: string,
  sample: {
    filename: string;
    is_stereo: boolean;
    kit_name: string;
    slot_number: number;
    source_path?: string;
    voice_number: number;
    wav_bit_depth?: number;
    wav_bitrate?: number;
    wav_channels?: number;
    wav_sample_rate?: number;
  },
) {
  if (!window.electronAPI?.insertSample) throw new Error("IPC not available");

  // Provide default values for required fields
  const sampleWithDefaults = {
    ...sample,
    source_path: sample.source_path || "",
    wav_bit_depth: sample.wav_bit_depth || null,
    wav_bitrate: sample.wav_bitrate || null,
    wav_channels: sample.wav_channels || null,
    wav_sample_rate: sample.wav_sample_rate || null,
  };

  const result = await window.electronAPI.insertSample(
    dbDir,
    sampleWithDefaults,
  );
  if (!result.success)
    throw new Error(result.error || "Failed to insert sample");
  return result.sampleId;
}
