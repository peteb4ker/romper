import type { SampleData } from "../components/kitTypes";

/**
 * Compatibility status for Rample hardware requirements
 */
export type CompatibilityStatus = "convertible" | "incompatible" | "native";

/**
 * Rample format requirements (matching scanner logic from PR70)
 */
const RAMPLE_FORMAT_REQUIREMENTS = {
  bitDepths: [8, 16] as number[],
  maxChannels: 2, // mono or stereo
  sampleRates: [44100] as number[],
};

/**
 * Creates enhanced formatted tooltip with better visual hierarchy
 * Alternative format emphasizing technical specifications
 * @param metadata Sample metadata
 * @param sourcePath File path to display
 * @param filename Sample filename to display
 * @returns Enhanced tooltip with visual structure
 */
export function formatEnhancedTooltip(
  metadata: SampleData,
  sourcePath: string,
  filename: string,
): string {
  const parts: string[] = [`📄 ${filename}`, `📁 ${sourcePath}`];

  if (
    metadata.wav_sample_rate ||
    metadata.wav_bit_depth ||
    metadata.wav_channels
  ) {
    const techSpecs: string[] = [];

    // Add sample rate with icon
    if (metadata.wav_sample_rate) {
      const rate =
        metadata.wav_sample_rate >= 1000
          ? `${(metadata.wav_sample_rate / 1000).toFixed(1)}kHz`
          : `${metadata.wav_sample_rate}Hz`;
      techSpecs.push(`⚡ ${rate}`);
    }

    // Add bit depth with icon
    if (metadata.wav_bit_depth) {
      techSpecs.push(`🔢 ${metadata.wav_bit_depth}-bit`);
    }

    // Add channels with icon
    if (metadata.wav_channels) {
      const channels =
        metadata.wav_channels === 1
          ? "Mono"
          : metadata.wav_channels === 2
            ? "Stereo"
            : `${metadata.wav_channels}ch`;
      techSpecs.push(`🎛️ ${channels}`);
    }

    parts.push(techSpecs.join(" • "));

    // Compatibility status on separate line for emphasis
    const compatibility = getCompatibilityStatus(metadata);
    const display = getCompatibilityDisplay(compatibility);
    const statusText = display.emoji
      ? `${display.emoji} ${display.text}`
      : `✅ ${display.text}`;
    parts.push(`🎯 Status: ${statusText}`);
  }

  return parts.join("\n");
}

/**
 * Creates complete formatted tooltip content with metadata and compatibility
 * Uses enhanced visual formatting for better information hierarchy
 * @param metadata Sample metadata
 * @param sourcePath File path to display
 * @param filename Sample filename to display
 * @returns Formatted tooltip content with enhanced visual structure
 */
export function formatTooltip(
  metadata: SampleData,
  sourcePath: string,
  filename: string,
): string {
  const parts: string[] = [filename, sourcePath];

  const wavInfo = formatWavMetadata(metadata);
  if (wavInfo) {
    const compatibility = getCompatibilityStatus(metadata);
    const display = getCompatibilityDisplay(compatibility);

    // Use ► symbol for technical specs to make them stand out
    const statusText = display.emoji
      ? `${display.emoji} ${display.text}`
      : display.text;
    parts.push(`► ${wavInfo} • ${statusText}`);
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

  // Sample rate
  if (metadata.wav_sample_rate) {
    const sampleRate = metadata.wav_sample_rate;
    if (sampleRate >= 1000) {
      parts.push(`${(sampleRate / 1000).toFixed(1)}kHz`);
    } else {
      parts.push(`${sampleRate}Hz`);
    }
  }

  // Bit depth
  if (metadata.wav_bit_depth) {
    parts.push(`${metadata.wav_bit_depth}-bit`);
  }

  // Channels
  if (metadata.wav_channels) {
    if (metadata.wav_channels === 1) {
      parts.push("Mono");
    } else if (metadata.wav_channels === 2) {
      parts.push("Stereo");
    } else {
      parts.push(`${metadata.wav_channels}ch`);
    }
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
    case "incompatible":
      return {
        colorClass: "text-red-600 dark:text-red-400",
        emoji: "❌",
        text: "Incompatible",
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
 * Determines compatibility status based on WAV metadata
 * @param metadata Sample metadata containing WAV properties
 * @returns Compatibility status
 */
export function getCompatibilityStatus(
  metadata: SampleData,
): CompatibilityStatus {
  // If we don't have metadata, assume compatible for backward compatibility
  if (
    !metadata.wav_bit_depth ||
    !metadata.wav_channels ||
    !metadata.wav_sample_rate
  ) {
    return "native";
  }

  const {
    wav_bit_depth: bitDepth,
    wav_channels: channels,
    wav_sample_rate: sampleRate,
  } = metadata;

  // Check if natively compatible (no conversion needed)
  const bitDepthOk = RAMPLE_FORMAT_REQUIREMENTS.bitDepths.includes(bitDepth);
  const channelsOk = channels <= RAMPLE_FORMAT_REQUIREMENTS.maxChannels;
  const sampleRateOk =
    RAMPLE_FORMAT_REQUIREMENTS.sampleRates.includes(sampleRate);

  if (bitDepthOk && channelsOk && sampleRateOk) {
    return "native";
  }

  // Check if convertible (supported by sync process)
  // Rample can handle format conversion for bit depth and sample rate
  // but has limits on channels
  if (channelsOk) {
    return "convertible";
  }

  return "incompatible";
}
