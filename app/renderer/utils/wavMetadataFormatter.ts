import {
  formatOfStoredSample,
  planConversion,
} from "@romper/shared/rampleFormat";

import type { SampleData } from "../components/kitTypes";

/** What the badge needs to know about the sample's voice */
export interface CompatibilityOptions {
  /**
   * The voice plays in a stereo pair, as the write makes it (`playsStereo`);
   * on a mono voice a stereo file is mixed down
   */
  stereoVoice?: boolean;
}

/**
 * What a write does to a sample's file, as its format badge shows it:
 * written as it is ("native") or re-encoded ("convertible")
 */
export type CompatibilityStatus = "convertible" | "native";

/**
 * Creates complete formatted tooltip content with metadata and compatibility
 * Uses enhanced visual formatting for better information hierarchy
 * @param metadata Sample metadata
 * @param sourcePath File path to display
 * @param filename Sample filename to display
 * @param options The sample's voice, which decides a mixdown
 * @returns Formatted tooltip content with enhanced visual structure
 */
export function formatTooltip(
  metadata: SampleData,
  sourcePath: string,
  filename: string,
  options: CompatibilityOptions = {},
): string {
  const parts: string[] = [filename, sourcePath];

  const wavInfo = formatWavMetadata(metadata);
  if (wavInfo) {
    // Use ► symbol for technical specs to make them stand out. The status
    // is left out when the stored format can't say what the write does.
    const compatibility = getCompatibilityStatus(metadata, options);
    if (compatibility) {
      const display = getCompatibilityDisplay(compatibility);
      parts.push(`► ${wavInfo} • ${display.emoji} ${display.text}`);
    } else {
      parts.push(`► ${wavInfo}`);
    }
  }

  return parts.join("\n");
}

/**
 * Formats WAV metadata for display in tooltips
 * @param metadata Sample metadata containing WAV properties
 * @returns Formatted string like "44.1kHz • 16-bit • Stereo"
 */
export function formatWavMetadata(metadata: SampleData): string {
  const parts: string[] = [];

  if (metadata.wav_sample_rate) {
    parts.push(formatSampleRate(metadata.wav_sample_rate));
  }
  if (metadata.wav_bit_depth) {
    parts.push(`${metadata.wav_bit_depth}-bit`);
  }
  if (metadata.wav_channels) {
    parts.push(formatChannels(metadata.wav_channels));
  }

  return parts.join(" • ");
}

/**
 * Gets display information for compatibility status
 * @param status Compatibility status
 * @returns Object with display text and emoji indicator
 */
export function getCompatibilityDisplay(status: CompatibilityStatus): {
  colorClass: string;
  emoji: string;
  text: string;
} {
  switch (status) {
    case "convertible":
      return {
        colorClass: "text-yellow-600 dark:text-yellow-400",
        emoji: "🟡",
        text: "Convertible",
      };
    case "native":
      return {
        colorClass: "text-green-600 dark:text-green-400",
        emoji: "✓",
        text: "Native",
      };
  }
}

/**
 * What the write does to a sample's file, by the rule the write itself
 * plans with (`planConversion`, #576): its format against the Rample's,
 * the voice's stereo setting and the sample's gain. Null when the stored
 * format is missing a value the answer depends on.
 *
 * The format is the store's copy (`wav_*`), from when the sample was added,
 * last scanned, or last checked when its kit opened. A file changed on
 * disk since then shows its old format until it's read again.
 */
export function getCompatibilityStatus(
  metadata: SampleData,
  options: CompatibilityOptions = {},
): CompatibilityStatus | null {
  const plan = planConversion(formatOfStoredSample(metadata), {
    gainDb: metadata.gain_db,
    stereoVoice: options.stereoVoice,
  });
  if (plan.reason) return "convertible";
  return plan.unknown ? null : "native";
}

/**
 * Format channel count for display
 */
function formatChannels(channels: number): string {
  if (channels === 1) return "Mono";
  if (channels === 2) return "Stereo";
  return `${channels}ch`;
}

/**
 * Format sample rate value for display
 */
function formatSampleRate(sampleRate: number): string {
  return sampleRate >= 1000
    ? `${(sampleRate / 1000).toFixed(1)}kHz`
    : `${sampleRate}Hz`;
}
