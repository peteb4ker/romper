import fs from "fs";
import path from "path";

export interface KitSamplePlanSlot {
  /** Absolute or relative path to the source file (before commit) */
  source: string;
  /** Intended filename in the kit (e.g. '1 Kick.wav') */
  target: string;
  /** Inferred or user-assigned voice type (e.g. 'Kick', 'Snare', etc.) */
  voiceType?: string;
  /** Optional extra metadata (length, format, etc.) */
  meta?: Record<string, any>;
}

export interface RampleKitLabel {
  label: string;
  description?: string;
  tags?: string[];
  /**
   * Optional working plan for sample assignments (up to 12 slots, sequential, no gaps).
   * If present, this is the working copy for the kit's sample assignments.
   */
  plan?: KitSamplePlanSlot[];
  /**
   * Optional mapping of voice number to inferred or user-assigned name (e.g. {1: 'Kick', 2: 'Snare'})
   */
  voiceNames?: Record<number, string>;
}

export interface RampleLabels {
  kits: Record<string, RampleKitLabel>;
}

/**
 * Reads the .rample_labels.json file from the SD card root.
 * @param sdCardPath Path to the SD card root
 * @returns Parsed RampleLabels object, or null if not found/invalid
 */
export function readRampleLabels(sdCardPath: string): RampleLabels | null {
  const filePath = path.join(sdCardPath, ".rample_labels.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.kits || typeof parsed.kits !== "object") return null;
    for (const kitName in parsed.kits) {
      if (
        typeof parsed.kits[kitName] !== "object" ||
        parsed.kits[kitName] === null
      )
        return null;
    }
    return parsed as RampleLabels;
  } catch (e) {
    return null;
  }
}

/**
 * Writes the .rample_labels.json file to the SD card root.
 * @param sdCardPath Path to the SD card root
 * @param labels RampleLabels object to write
 */
export function writeRampleLabels(
  sdCardPath: string,
  labels: RampleLabels,
): void {
  const filePath = path.join(sdCardPath, ".rample_labels.json");
  console.log(`[rampleLabels] Writing labels to: ${filePath}`);
  fs.writeFileSync(filePath, JSON.stringify(labels, null, 2), "utf-8");
}
