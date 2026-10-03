import type { Sample } from "@romper/shared/db/schema.js";

/** The WAV header columns of a sample row */
export type WavMetadataFields = Pick<
  Sample,
  "wav_bit_depth" | "wav_bitrate" | "wav_channels" | "wav_sample_rate"
>;

/**
 * The `wav_*` columns for a file, from its parsed header. The bitrate is
 * sample rate × channels × bit depth, when all three are known.
 */
export function toWavMetadataFields(header: {
  bitDepth?: null | number;
  channels?: null | number;
  sampleRate?: null | number;
}): WavMetadataFields {
  const { bitDepth, channels, sampleRate } = header;
  return {
    wav_bit_depth: bitDepth ?? null,
    wav_bitrate:
      sampleRate && channels && bitDepth
        ? sampleRate * channels * bitDepth
        : null,
    wav_channels: channels ?? null,
    wav_sample_rate: sampleRate ?? null,
  };
}
