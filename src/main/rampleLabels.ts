import fs from 'fs';
import path from 'path';

export interface RampleKitLabel {
  label: string;
  description?: string;
  tags?: string[];
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
  const filePath = path.join(sdCardPath, '.rample_labels.json');
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.kits || typeof parsed.kits !== 'object') return null;
    for (const kitName in parsed.kits) {
      if (typeof parsed.kits[kitName] !== 'object' || parsed.kits[kitName] === null) return null;
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
export function writeRampleLabels(sdCardPath: string, labels: RampleLabels): void {
  const filePath = path.join(sdCardPath, '.rample_labels.json');
  console.log(`[rampleLabels] Writing labels to: ${filePath}`);
  fs.writeFileSync(filePath, JSON.stringify(labels, null, 2), 'utf-8');
}
