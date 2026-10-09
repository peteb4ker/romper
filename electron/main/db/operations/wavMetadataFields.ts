import type { Sample } from "@romper/shared/db/schema.js";

import { wavFormatTag } from "@romper/shared/rampleFormat.js";

/**
 * The columns a read of a sample's WAV header fills: the `wav_*` fields
 * and `source_status`, which records that it was read (#537)
 */
export type WavMetadataFields = Pick<
  Sample,
  | "source_status"
  | "wav_bit_depth"
  | "wav_bitrate"
  | "wav_channels"
  | "wav_format_tag"
  | "wav_sample_rate"
>;

/**
 * The columns for a file whose header was read, from the parsed header.
 * The bitrate is sample rate × channels × bit depth, when all three are
 * known. The format tag (#576) is the header's: PCM, float or extensible.
 */
export function toWavMetadataFields(header: {
  bitDepth?: null | number;
  channels?: null | number;
  encoding?: "float" | "pcm";
  extensible?: boolean;
  sampleRate?: null | number;
}): WavMetadataFields {
  const { bitDepth, channels, sampleRate } = header;
  return {
    source_status: "readable",
    wav_bit_depth: bitDepth ?? null,
    wav_bitrate:
      sampleRate && channels && bitDepth
        ? sampleRate * channels * bitDepth
        : null,
    wav_channels: channels ?? null,
    wav_format_tag: wavFormatTag(header),
    wav_sample_rate: sampleRate ?? null,
  };
}
