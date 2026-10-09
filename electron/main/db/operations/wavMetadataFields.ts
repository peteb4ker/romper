import type { Sample } from "@romper/shared/db/schema.js";

import { wavFormatTag } from "@romper/shared/rampleFormat.js";

/** A file's size in bytes and modification time, as `fs.Stats` has them */
export interface SourceFileStat {
  mtimeMs: number;
  size: number;
}

/**
 * The columns a read of a sample's WAV header fills: the `wav_*` fields,
 * `source_status`, which records that it was read (#537), and the file's
 * size and modification time when it was read, so a later check can tell
 * the file has changed (#793)
 */
export type WavMetadataFields = Pick<
  Sample,
  | "source_mtime_ms"
  | "source_size"
  | "source_status"
  | "wav_bit_depth"
  | "wav_bitrate"
  | "wav_channels"
  | "wav_format_tag"
  | "wav_sample_rate"
>;

/**
 * Whether a sample's file has changed since its header was read: its size
 * or modification time differs from the stored one. A row with neither
 * stored (older libraries, or a restored undo entry) counts as changed.
 */
export function hasFileChanged(
  stored: Pick<Sample, "source_mtime_ms" | "source_size">,
  current: SourceFileStat,
): boolean {
  return (
    stored.source_size !== current.size ||
    stored.source_mtime_ms !== Math.floor(current.mtimeMs)
  );
}

/**
 * The columns for a file whose header was read, from the parsed header.
 * The bitrate is sample rate × channels × bit depth, when all three are
 * known. The format tag (#576) is the header's: PCM, float or extensible.
 * `stat` is the file's size and modification time from before the header
 * was read (a file changing meanwhile then reads as changed next time);
 * without it they're null and the file is read again at the next check.
 */
export function toWavMetadataFields(
  header: {
    bitDepth?: null | number;
    channels?: null | number;
    encoding?: "float" | "pcm";
    extensible?: boolean;
    sampleRate?: null | number;
  },
  stat?: null | SourceFileStat,
): WavMetadataFields {
  const { bitDepth, channels, sampleRate } = header;
  return {
    source_mtime_ms: stat ? Math.floor(stat.mtimeMs) : null,
    source_size: stat ? stat.size : null,
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
