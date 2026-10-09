// The Rample's sample format, and what a write does to a file to meet it
// (#576). One rule for main and the renderer: the write plans each file's
// copy or conversion with `planConversion`, and a sample's format badge
// reads the same function, so the two can't disagree.
//
// From the Rample manual (https://squarp.net/rample/manual/), How to make
// your own sample kits: files must be "16–bit or 8–bit, 44100 Hz, minimum
// length 50ms". Everything else here is Romper's: what it converts, and
// mixing a stereo file down on a mono voice (see stereoLinkRules.ts).

import type { FormatIssue } from "./audioTypes.js";

export interface RampleFormatRequirements {
  readonly bitDepths: readonly number[];
  readonly fileExtensions: readonly string[];
  readonly maxChannels: number;
  readonly sampleRates: readonly number[];
}

export const RAMPLE_FORMAT_REQUIREMENTS: RampleFormatRequirements = {
  bitDepths: [8, 16],
  fileExtensions: [".wav"],
  maxChannels: 2, // mono or stereo
  sampleRates: [44100],
};

/** The manual's "minimum length 50ms" */
export const RAMPLE_MIN_LENGTH_MS = 50;

/** The fmt chunk's format tags Romper reads (wavHeader.ts) */
export const WAV_FORMAT_TAGS = {
  extensible: 0xfffe,
  float: 0x0003,
  pcm: 0x0001,
} as const;

export interface ConversionOptions {
  /** The sample's gain; any non-zero gain is baked in by re-encoding */
  gainDb?: null | number;
  /**
   * Whether the sample's voice plays in a stereo pair: `voices.stereo_mode`
   * with the links the write makes automatically. False: a stereo file is
   * mixed down to mono. Unknown (undefined): nothing is mixed down. Never
   * inferred from the file's channel count.
   */
  stereoVoice?: boolean;
}

/** What a write does to a sample's file */
export interface ConversionPlan {
  /** The Rample requirements the file misses; empty when it meets them */
  issues: FormatIssue[];
  /** A file with more than one channel on a mono voice: mixed to mono */
  mixdown: boolean;
  /**
   * Why the file is re-encoded: "format" when its format changes (an issue
   * or a mixdown), "gain" when it's re-encoded only to apply its gain, and
   * null when it's written as it is
   */
  reason: ConversionReason | null;
  /**
   * Nothing known needs converting, but the bit depth, channel count or
   * sample rate isn't known, so whether it's written as it is can't be
   * said. A header the write reads always has them.
   */
  unknown: boolean;
}

/** Why a file is converted: its format, or only to apply its gain */
export type ConversionReason = "format" | "gain";

/**
 * A file's format, from its header or the store's copy of it. The store
 * doesn't record the encoding or an extensible header, so a format without
 * them counts as plain integer PCM.
 */
export interface SampleFormat {
  bitDepth?: null | number;
  channels?: null | number;
  encoding?: "float" | "pcm";
  extensible?: boolean;
  /** Sample frames in the file (bytes of sample data / bytes per frame) */
  frames?: null | number;
  sampleRate?: null | number;
}

/**
 * The summary's line for the samples a write converts, e.g. "3 samples
 * will be converted (2 for format, 1 for gain)." Null when there are none.
 */
export function describeConversionCount(
  forFormat: number,
  forGain: number,
): null | string {
  const total = forFormat + forGain;
  if (total === 0) return null;
  const parts = [
    forFormat > 0 && `${forFormat} for format`,
    forGain > 0 && `${forGain} for gain`,
  ].filter(Boolean);
  const samples = total === 1 ? "1 sample" : `${total} samples`;
  return `${samples} will be converted (${parts.join(", ")}).`;
}

/**
 * The summary's warning for samples shorter than the manual's minimum,
 * e.g. "2 samples are shorter than the Rample's 50 ms minimum." Null when
 * there are none.
 */
export function describeTooShortCount(count: number): null | string {
  if (count === 0) return null;
  const samples = count === 1 ? "1 sample is" : `${count} samples are`;
  return `${samples} shorter than the Rample's ${RAMPLE_MIN_LENGTH_MS} ms minimum.`;
}

/**
 * The Rample requirements a file's format misses. A value that isn't known
 * isn't an issue; {@link planConversion} says when that leaves the answer
 * unknown.
 */
export function formatIssues(format: SampleFormat): FormatIssue[] {
  const issues: FormatIssue[] = [];
  const { bitDepth, channels, encoding, extensible, sampleRate } = format;

  // Float samples and extensible headers are converted to plain PCM
  if (encoding === "float") {
    issues.push({
      current: `${bitDepth}-bit float`,
      message: `${bitDepth}-bit float samples will be converted to 16-bit PCM.`,
      required: "PCM",
      type: "encoding",
    });
  } else if (extensible) {
    issues.push({
      current: "WAVE_FORMAT_EXTENSIBLE",
      message:
        "The file has an extended WAV header; it will be rewritten as a standard WAV.",
      required: "PCM",
      type: "encoding",
    });
  }

  // A float file's bit depth is covered above
  if (
    encoding !== "float" &&
    bitDepth != null &&
    !RAMPLE_FORMAT_REQUIREMENTS.bitDepths.includes(bitDepth)
  ) {
    issues.push({
      current: bitDepth,
      message: `Bit depth ${bitDepth} is not supported. Rample supports ${RAMPLE_FORMAT_REQUIREMENTS.bitDepths.join(", ")} bit only.`,
      required: RAMPLE_FORMAT_REQUIREMENTS.bitDepths,
      type: "bitDepth",
    });
  }

  if (
    sampleRate != null &&
    !RAMPLE_FORMAT_REQUIREMENTS.sampleRates.includes(sampleRate)
  ) {
    issues.push({
      current: sampleRate,
      message: `Sample rate ${sampleRate} Hz is not supported. Rample requires ${RAMPLE_FORMAT_REQUIREMENTS.sampleRates[0]} Hz.`,
      required: RAMPLE_FORMAT_REQUIREMENTS.sampleRates[0],
      type: "sampleRate",
    });
  }

  // More than two channels are converted to stereo (or mixed to mono)
  if (channels != null && channels > RAMPLE_FORMAT_REQUIREMENTS.maxChannels) {
    issues.push({
      current: channels,
      message: `${channels} channels not supported. Rample supports mono (1) or stereo (2) only.`,
      required: `1-${RAMPLE_FORMAT_REQUIREMENTS.maxChannels}`,
      type: "channels",
    });
  }

  return issues;
}

/**
 * A sample's format as the store records it (the `wav_*` columns). A row
 * without a format tag (read before #576) counts as plain PCM.
 */
export function formatOfStoredSample(sample: {
  wav_bit_depth?: null | number;
  wav_channels?: null | number;
  wav_format_tag?: null | number;
  wav_sample_rate?: null | number;
}): SampleFormat {
  return {
    bitDepth: sample.wav_bit_depth,
    channels: sample.wav_channels,
    encoding: sample.wav_format_tag === WAV_FORMAT_TAGS.float ? "float" : "pcm",
    extensible: sample.wav_format_tag === WAV_FORMAT_TAGS.extensible,
    sampleRate: sample.wav_sample_rate,
  };
}

/**
 * Whether a file is shorter than the manual's 50 ms minimum, from its
 * frame count and sample rate. Exactly 50 ms isn't shorter. False when
 * either isn't known.
 */
export function isShorterThanRampleMinimum(format: SampleFormat): boolean {
  const { frames, sampleRate } = format;
  if (frames == null || !sampleRate) return false;
  // frames / sampleRate < 50 / 1000, in integers
  return frames * 1000 < RAMPLE_MIN_LENGTH_MS * sampleRate;
}

/**
 * What a write does to a sample's file: written as it is, or re-encoded
 * for its format or its gain. The write plans every file with it, and a
 * sample's format badge shows it.
 */
export function planConversion(
  format: SampleFormat,
  options: ConversionOptions = {},
): ConversionPlan {
  const issues = formatIssues(format);
  const mixdown = options.stereoVoice === false && (format.channels ?? 0) > 1;
  const unknown =
    issues.length === 0 &&
    !mixdown &&
    (format.bitDepth == null ||
      format.channels == null ||
      format.sampleRate == null);

  let reason: ConversionReason | null = null;
  if (issues.length > 0 || mixdown) reason = "format";
  else if (options.gainDb != null && options.gainDb !== 0) reason = "gain";

  return { issues, mixdown, reason, unknown: unknown && reason === null };
}

/**
 * The format tag the store records for a header: extensible, float or
 * PCM. Null when the header's encoding isn't known.
 */
export function wavFormatTag(header: {
  encoding?: "float" | "pcm";
  extensible?: boolean;
}): null | number {
  if (header.extensible) return WAV_FORMAT_TAGS.extensible;
  if (!header.encoding) return null;
  return WAV_FORMAT_TAGS[header.encoding];
}
