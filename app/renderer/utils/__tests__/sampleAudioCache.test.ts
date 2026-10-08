import type { SampleAudio } from "@romper/shared/audioTypes";
import type { DbResult } from "@romper/shared/db/schema";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSampleAudioCache,
  loadSampleAudio,
  SAMPLE_AUDIO_CACHE_BYTES,
  sampleAudioCacheSize,
  SampleAudioDecodeError,
} from "../sampleAudioCache";

vi.mock("../sharedAudioContext", () => ({
  getSharedAudioContext: vi.fn(),
}));

/** A decoded buffer of `bytes` (one channel of 32-bit floats) */
interface FakeBuffer {
  file: string;
  length: number;
  numberOfChannels: number;
}

/**
 * Main, as the cache sees it: which file is in each slot, and each file's
 * current version. Answers the way the real handler does: no bytes when
 * the caller holds the current version.
 */
function fakeMain() {
  const slots = new Map<string, string>();
  const versions = new Map<string, number>();
  const sizes = new Map<string, number>();
  const api = vi.mocked(globalThis.electronAPI.getSampleAudioBuffer);
  api.mockImplementation(
    async (
      kitName: string,
      voiceNumber: number,
      slotNumber: number,
      knownVersion?: string,
    ): Promise<DbResult<null | SampleAudio>> => {
      const file = slots.get(`${kitName}:${voiceNumber}:${slotNumber}`);
      if (!file) return { data: null, success: true };
      const version = `${versions.get(file) ?? 0}:${file}`;
      if (version === knownVersion) {
        return { data: { bytes: null, version }, success: true };
      }
      const bytes = new ArrayBuffer(4);
      fileOf.set(bytes, { file, size: sizes.get(file) ?? 1000 });
      return { data: { bytes, version }, success: true };
    },
  );
  return {
    api,
    /** The file is rewritten in place, e.g. edited in another app */
    edit(file: string) {
      versions.set(file, (versions.get(file) ?? 0) + 1);
    },
    put(slot: string, file: string, decodedBytes = 1000) {
      slots.set(slot, file);
      sizes.set(file, decodedBytes);
    },
    remove(slot: string) {
      slots.delete(slot);
    },
  };
}

/** Which file each sent ArrayBuffer holds, so decodes can tell them apart */
const fileOf = new WeakMap<ArrayBuffer, { file: string; size: number }>();

function fakeContext() {
  const decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => {
    const { file, size } = fileOf.get(bytes)!;
    const buffer: FakeBuffer = {
      file,
      length: size / 4,
      numberOfChannels: 1,
    };
    return buffer as unknown as AudioBuffer;
  });
  return {
    ctx: { decodeAudioData } as unknown as BaseAudioContext,
    decodeAudioData,
  };
}

const slotA = { kitName: "A0", slotNumber: 0, voiceNumber: 1 };
const fileOfBuffer = (b: AudioBuffer | null) =>
  (b as unknown as FakeBuffer | null)?.file;

describe("[Q-01] sample audio cache (#478)", () => {
  let main: ReturnType<typeof fakeMain>;
  let decoder: ReturnType<typeof fakeContext>;

  beforeEach(() => {
    clearSampleAudioCache();
    main = fakeMain();
    decoder = fakeContext();
  });

  describe("a hit", () => {
    it("decodes a slot's file once, and main sends it once", async () => {
      main.put("A0:1:0", "/s/kick.wav");

      const first = await loadSampleAudio(slotA, decoder.ctx);
      const again = await loadSampleAudio(slotA, decoder.ctx);

      expect(again).toBe(first);
      expect(decoder.decodeAudioData).toHaveBeenCalledTimes(1);
      // The second ask offers the version it holds; main sends no bytes
      expect(main.api).toHaveBeenLastCalledWith("A0", 1, 0, "0:/s/kick.wav");
      const answer = await main.api.mock.results[1].value;
      expect(answer.data.bytes).toBeNull();
    });

    it("shares one decode between the waveform and the slice strip", async () => {
      main.put("A0:1:0", "/s/kick.wav");

      // The waveform before the kit's rows arrive, then the strip, which
      // knows the file
      const waveform = await loadSampleAudio(slotA, decoder.ctx);
      const strip = await loadSampleAudio(
        { ...slotA, sampleSource: "/s/kick.wav" },
        decoder.ctx,
      );

      expect(strip).toBe(waveform);
      expect(decoder.decodeAudioData).toHaveBeenCalledTimes(1);
    });

    it("decodes once when two loads of a file arrive together", async () => {
      main.put("A0:1:0", "/s/kick.wav");

      const [a, b] = await Promise.all([
        loadSampleAudio(slotA, decoder.ctx),
        loadSampleAudio(slotA, decoder.ctx),
      ]);

      expect(a).toBe(b);
      expect(decoder.decodeAudioData).toHaveBeenCalledTimes(1);
    });

    it("finds a file it holds when it has moved to another slot", async () => {
      main.put("A0:1:1", "/s/snare.wav");
      await loadSampleAudio({ ...slotA, slotNumber: 1 }, decoder.ctx);

      // A delete above it moves the snare up into slot 0
      main.remove("A0:1:1");
      main.put("A0:1:0", "/s/snare.wav");
      const moved = await loadSampleAudio(
        { ...slotA, sampleSource: "/s/snare.wav" },
        decoder.ctx,
      );

      expect(fileOfBuffer(moved)).toBe("/s/snare.wav");
      expect(decoder.decodeAudioData).toHaveBeenCalledTimes(1);
    });
  });

  describe("never stale", () => {
    it("loads the file again when it's rewritten", async () => {
      main.put("A0:1:0", "/s/kick.wav");
      const before = await loadSampleAudio(slotA, decoder.ctx);

      main.edit("/s/kick.wav");
      const after = await loadSampleAudio(slotA, decoder.ctx);

      expect(after).not.toBe(before);
      expect(decoder.decodeAudioData).toHaveBeenCalledTimes(2);
    });

    it("loads the new file when another takes the slot", async () => {
      main.put("A0:1:0", "/s/kick.wav");
      await loadSampleAudio(slotA, decoder.ctx);

      // Replaced, or a delete moved the next sample up
      main.put("A0:1:0", "/s/snare.wav");
      // The renderer may still think the old file is there
      const now = await loadSampleAudio(
        { ...slotA, sampleSource: "/s/kick.wav" },
        decoder.ctx,
      );

      expect(fileOfBuffer(now)).toBe("/s/snare.wav");
    });

    it("returns null once the slot is emptied", async () => {
      main.put("A0:1:0", "/s/kick.wav");
      await loadSampleAudio(slotA, decoder.ctx);

      main.remove("A0:1:0");

      expect(await loadSampleAudio(slotA, decoder.ctx)).toBeNull();
    });

    it("keeps slots of different kits apart", async () => {
      main.put("A0:1:0", "/s/kick.wav");
      main.put("B0:1:0", "/s/snare.wav");

      const a = await loadSampleAudio(slotA, decoder.ctx);
      const b = await loadSampleAudio({ ...slotA, kitName: "B0" }, decoder.ctx);

      expect(fileOfBuffer(a)).toBe("/s/kick.wav");
      expect(fileOfBuffer(b)).toBe("/s/snare.wav");
    });
  });

  describe("failures", () => {
    it("throws main's error", async () => {
      main.api.mockResolvedValueOnce({ error: "gone", success: false });

      await expect(loadSampleAudio(slotA, decoder.ctx)).rejects.toThrow("gone");
    });

    it("throws SampleAudioDecodeError for audio it can't decode, and doesn't keep it", async () => {
      main.put("A0:1:0", "/s/broken.wav");
      const reason = new Error("Unable to decode audio data");
      decoder.decodeAudioData.mockRejectedValueOnce(reason);

      const failed = loadSampleAudio(slotA, decoder.ctx);
      await expect(failed).rejects.toBeInstanceOf(SampleAudioDecodeError);
      await expect(failed).rejects.toHaveProperty("cause", reason);

      // Nothing was cached, so the next load asks for the bytes again
      await loadSampleAudio(slotA, decoder.ctx);
      expect(main.api).toHaveBeenLastCalledWith("A0", 1, 0, undefined);
    });
  });

  describe("bounded", () => {
    const third = SAMPLE_AUDIO_CACHE_BYTES / 2 - 1;

    it("evicts the least recently used audio past its budget", async () => {
      main.put("A0:1:0", "/s/one.wav", third);
      main.put("A0:1:1", "/s/two.wav", third);
      main.put("A0:1:2", "/s/three.wav", third);
      const slot = (n: number) => ({ ...slotA, slotNumber: n });

      await loadSampleAudio(slot(0), decoder.ctx);
      await loadSampleAudio(slot(1), decoder.ctx);
      // Slot 0 is used again, so slot 1 is now the oldest
      await loadSampleAudio(slot(0), decoder.ctx);
      await loadSampleAudio(slot(2), decoder.ctx);

      expect(sampleAudioCacheSize()).toEqual({
        bytes: 2 * third,
        entries: 2,
      });
      // Slot 1's audio was evicted: it isn't offered, so main sends it
      await loadSampleAudio(slot(1), decoder.ctx);
      expect(main.api).toHaveBeenLastCalledWith("A0", 1, 1, undefined);
      // Slot 2's is still held
      await loadSampleAudio(slot(2), decoder.ctx);
      expect(main.api).toHaveBeenLastCalledWith("A0", 1, 2, "0:/s/three.wav");
    });

    it("plays audio bigger than the budget without keeping it", async () => {
      main.put("A0:1:0", "/s/huge.wav", SAMPLE_AUDIO_CACHE_BYTES + 4);

      const huge = await loadSampleAudio(slotA, decoder.ctx);

      expect(fileOfBuffer(huge)).toBe("/s/huge.wav");
      expect(sampleAudioCacheSize()).toEqual({ bytes: 0, entries: 0 });
    });
  });
});
