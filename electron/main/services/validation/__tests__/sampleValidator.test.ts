import * as fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAudioMetadata } from "../../../audioUtils.js";
import * as romperDbCoreORM from "../../../db/romperDbCoreORM.js";
import { SampleValidator } from "../sampleValidator";

vi.mock("node:fs", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:fs")>()),
);
vi.mock("../../../db/romperDbCoreORM.js");
vi.mock("../../../audioUtils.js", () => ({ getAudioMetadata: vi.fn() }));

const mockFs = vi.mocked(fs);
const mockORM = vi.mocked(romperDbCoreORM);

describe("SampleValidator", () => {
  let validator: SampleValidator;

  beforeEach(() => {
    validator = new SampleValidator();
    vi.clearAllMocks();
  });

  describe("validateVoiceAndSlot", () => {
    it("should accept valid voice and slot numbers", () => {
      const result = validator.validateVoiceAndSlot(1, 0);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept voice 4 and slot 11", () => {
      const result = validator.validateVoiceAndSlot(4, 11);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject voice number too low", () => {
      const result = validator.validateVoiceAndSlot(0, 5);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
    });

    it("should reject voice number too high", () => {
      const result = validator.validateVoiceAndSlot(5, 5);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
    });

    it("should reject slot number too low", () => {
      const result = validator.validateVoiceAndSlot(2, -1);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Slot index must be between 0 and 11 (12 slots per voice)",
      );
    });

    it("should reject slot number too high", () => {
      const result = validator.validateVoiceAndSlot(2, 12);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Slot index must be between 0 and 11 (12 slots per voice)",
      );
    });

    it.each([Number.NaN, 1.5, Infinity])(
      "[Q-02] rejects voice %s, which isn't a whole number (RE-25)",
      (voice) => {
        expect(validator.validateVoiceAndSlot(voice, 0)).toEqual({
          error: "Voice number must be between 1 and 4",
          isValid: false,
        });
      },
    );

    it.each([Number.NaN, 0.5, Infinity])(
      "[Q-02] rejects slot %s, which isn't a whole number (RE-25)",
      (slot) => {
        expect(validator.validateVoiceAndSlot(1, slot)).toEqual({
          error: "Slot index must be between 0 and 11 (12 slots per voice)",
          isValid: false,
        });
      },
    );
  });

  describe("validateSampleFile", () => {
    it("should reject non-existent files", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = validator.validateSampleFile("/path/to/file.wav");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Sample file not found");
    });

    it("should reject non-WAV files", () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = validator.validateSampleFile("/path/to/file.mp3");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Only WAV files are supported");
    });

    it("rejects a file it can't read as an uncompressed WAV (RE-08)", () => {
      mockFs.existsSync.mockReturnValue(true);
      vi.mocked(getAudioMetadata).mockReturnValue({
        error:
          "Unsupported WAV encoding (format 0x0002); only uncompressed PCM or float can be used",
        success: false,
      });

      const result = validator.validateSampleFile("/path/to/file.wav");

      expect(getAudioMetadata).toHaveBeenCalledWith("/path/to/file.wav");
      expect(result).toEqual({
        error:
          "Can't use this file: Unsupported WAV encoding (format 0x0002); only uncompressed PCM or float can be used",
        isValid: false,
      });
    });

    it("accepts a readable WAV, even one sync will convert", () => {
      mockFs.existsSync.mockReturnValue(true);
      vi.mocked(getAudioMetadata).mockReturnValue({
        data: { bitDepth: 24, channels: 2, sampleRate: 48000 },
        success: true,
      });

      const result = validator.validateSampleFile("/path/to/file.wav");

      // The header's columns come back, so add and replace can store them
      expect(result).toEqual({
        isValid: true,
        metadata: {
          source_status: "readable",
          wav_bit_depth: 24,
          wav_bitrate: 48000 * 2 * 24,
          wav_channels: 2,
          wav_format_tag: null,
          wav_sample_rate: 48000,
        },
      });
    });
  });

  describe("validateVoiceNotLinkedPartner", () => {
    const kitWithVoice1Linked = (linked: boolean) =>
      ({
        data: {
          voices: [1, 2, 3, 4].map((voice_number) => ({
            stereo_mode: linked && voice_number === 1,
            voice_number,
          })),
        },
        success: true,
      }) as ReturnType<typeof romperDbCoreORM.getKit>;

    it("[UC-28] refuses the right channel of a linked pair (RE-69)", () => {
      mockORM.getKit.mockReturnValue(kitWithVoice1Linked(true));

      const result = validator.validateVoiceNotLinkedPartner("/db", "A0", 2);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        "Voice 2 is linked to voice 1 for stereo. Unlink them to put samples on voice 2.",
      );
      expect(mockORM.getKit).toHaveBeenCalledWith("/db", "A0");
    });

    it("[UC-28] accepts the linked voice itself and voices outside the pair", () => {
      mockORM.getKit.mockReturnValue(kitWithVoice1Linked(true));

      expect(validator.validateVoiceNotLinkedPartner("/db", "A0", 1)).toEqual({
        isValid: true,
      });
      expect(validator.validateVoiceNotLinkedPartner("/db", "A0", 3)).toEqual({
        isValid: true,
      });
    });

    it("accepts voice 2 once the pair is unlinked", () => {
      mockORM.getKit.mockReturnValue(kitWithVoice1Linked(false));

      expect(validator.validateVoiceNotLinkedPartner("/db", "A0", 2)).toEqual({
        isValid: true,
      });
    });

    it("accepts when the kit can't be read", () => {
      mockORM.getKit.mockReturnValue({ error: "no kit", success: false });

      expect(validator.validateVoiceNotLinkedPartner("/db", "A0", 2)).toEqual({
        isValid: true,
      });
    });
  });
});
