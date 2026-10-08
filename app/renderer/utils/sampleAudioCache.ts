/**
 * Decoded sample audio, kept so a kit you come back to doesn't load its
 * samples again, and so the slot waveforms and the slice strip decode a
 * sample once between them (#478, RE-83).
 *
 * Every load still asks main for the slot, with the version of the file the
 * cache holds for it. Main looks up the slot's row and the file's current
 * version (path, size, modification time, inode), and sends the file only
 * when that differs. So the cache can't serve stale audio: another file in
 * the slot, or the same file edited in another app, is a new version and
 * comes back in full. What it saves is the file read, the bytes over IPC
 * and the decode.
 *
 * Entries are decoded buffers (32-bit float per channel), evicted least
 * recently used once they pass SAMPLE_AUDIO_CACHE_BYTES. A component
 * playing an evicted buffer keeps its own reference.
 */
import { getSharedAudioContext } from "./sharedAudioContext";

/** Upper bound on the decoded audio the cache keeps */
export const SAMPLE_AUDIO_CACHE_BYTES = 128 * 1024 * 1024;

/** One slot, and the file the renderer thinks is in it */
export interface SampleAudioSlot {
  kitName: string;
  /** The slot's `source_path`, when known; a hint, not trusted */
  sampleSource?: null | string;
  slotNumber: number;
  voiceNumber: number;
}

/** The slot's file was read, but isn't audio the browser can decode */
export class SampleAudioDecodeError extends Error {
  constructor(cause: unknown) {
    super("Can't decode sample audio", { cause });
    this.name = "SampleAudioDecodeError";
  }
}

/** Buffers by version, least recently used first */
const buffers = new Map<string, AudioBuffer>();
let cachedBytes = 0;
/** The last version seen in a slot, and for a source file */
const versionBySlot = new Map<string, string>();
const versionBySource = new Map<string, string>();
/** Decodes in progress, so two loads of one version decode it once */
const decoding = new Map<string, Promise<AudioBuffer>>();

/** Empty the cache (for tests) */
export function clearSampleAudioCache(): void {
  buffers.clear();
  cachedBytes = 0;
  versionBySlot.clear();
  versionBySource.clear();
  decoding.clear();
}

/**
 * The slot's decoded audio, or null for an empty slot. Throws when main
 * can't read the file, and SampleAudioDecodeError when it can't be decoded.
 * `ctx` decodes new audio; the buffer can play in any context.
 */
export async function loadSampleAudio(
  slot: SampleAudioSlot,
  ctx: BaseAudioContext = getSharedAudioContext(),
): Promise<AudioBuffer | null> {
  const { kitName, sampleSource, slotNumber, voiceNumber } = slot;
  const slotKey = `${kitName}\u0000${voiceNumber}\u0000${slotNumber}`;
  // Offer main the version held for the file the slot should have, or else
  // for whatever was last in the slot. Held right here, so an eviction
  // while main answers can't lose it.
  const knownVersion =
    (sampleSource == null ? undefined : versionBySource.get(sampleSource)) ??
    versionBySlot.get(slotKey);
  const known =
    knownVersion === undefined ? undefined : buffers.get(knownVersion);

  const result = await globalThis.electronAPI.getSampleAudioBuffer(
    kitName,
    voiceNumber,
    slotNumber,
    known ? knownVersion : undefined,
  );
  if (!result.success) {
    throw new Error(result.error ?? "Failed to load sample audio");
  }
  const audio = result.data;
  if (!audio) {
    versionBySlot.delete(slotKey);
    return null;
  }

  let buffer: AudioBuffer;
  if (audio.bytes) {
    // Another load may have decoded this version since we asked
    buffer =
      buffers.get(audio.version) ??
      (await decodeOnce(audio.version, audio.bytes, ctx));
  } else if (known && audio.version === knownVersion) {
    buffer = known;
  } else {
    throw new Error("Main sent no audio for a version the cache doesn't hold");
  }
  remember(audio.version, buffer);
  versionBySlot.set(slotKey, audio.version);
  if (sampleSource != null) versionBySource.set(sampleSource, audio.version);
  return buffer;
}

/** How much decoded audio the cache holds, in bytes and buffers */
export function sampleAudioCacheSize(): { bytes: number; entries: number } {
  return { bytes: cachedBytes, entries: buffers.size };
}

function bytesOf(buffer: AudioBuffer): number {
  return buffer.length * buffer.numberOfChannels * 4;
}

function decodeOnce(
  version: string,
  bytes: ArrayBuffer,
  ctx: BaseAudioContext,
): Promise<AudioBuffer> {
  const pending = decoding.get(version);
  if (pending) return pending;
  const decode = ctx
    .decodeAudioData(bytes)
    .catch((err: unknown) => {
      throw new SampleAudioDecodeError(err);
    })
    .finally(() => decoding.delete(version));
  decoding.set(version, decode);
  return decode;
}

/** Drop the least recently used buffers until the cache fits */
function evict(): void {
  for (const [version, buffer] of buffers) {
    if (cachedBytes <= SAMPLE_AUDIO_CACHE_BYTES) return;
    buffers.delete(version);
    cachedBytes -= bytesOf(buffer);
    forget(versionBySlot, version);
    forget(versionBySource, version);
  }
}

function forget(index: Map<string, string>, version: string): void {
  for (const [key, held] of index) {
    if (held === version) index.delete(key);
  }
}

/** Keep a buffer as the most recently used */
function remember(version: string, buffer: AudioBuffer): void {
  const held = buffers.get(version);
  if (held) {
    buffers.delete(version);
    buffers.set(version, held);
    return;
  }
  const size = bytesOf(buffer);
  // Bigger than the whole cache: play it, don't keep it
  if (size > SAMPLE_AUDIO_CACHE_BYTES) return;
  buffers.set(version, buffer);
  cachedBytes += size;
  evict();
}
