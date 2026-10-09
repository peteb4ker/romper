import { describe, expect, it } from "vitest";

import type { SampleData } from "../../components/kitTypes";

import {
  formatTooltip,
  formatWavMetadata,
  getCompatibilityDisplay,
  getCompatibilityStatus,
} from "../wavMetadataFormatter";

describe("wavMetadataFormatter", () => {
  describe("formatWavMetadata", () => {
    it("formats complete metadata correctly", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_channels: 2,
        wav_sample_rate: 44100,
      };

      const result = formatWavMetadata(metadata);
      expect(result).toBe("44.1kHz • 16-bit • Stereo");
    });

    it("formats mono sample correctly", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 24,
        wav_channels: 1,
        wav_sample_rate: 48000,
      };

      const result = formatWavMetadata(metadata);
      expect(result).toBe("48.0kHz • 24-bit • Mono");
    });

    it("handles missing metadata gracefully", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
      };

      const result = formatWavMetadata(metadata);
      expect(result).toBe("");
    });

    it("handles partial metadata", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_sample_rate: 44100,
      };

      const result = formatWavMetadata(metadata);
      expect(result).toBe("44.1kHz • 16-bit");
    });

    it("formats unusual channel counts", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_channels: 6,
      };

      const result = formatWavMetadata(metadata);
      expect(result).toBe("6ch");
    });

    it("handles low sample rates under 1000Hz", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_sample_rate: 800,
      };

      const result = formatWavMetadata(metadata);
      expect(result).toBe("800Hz");
    });

    it("handles edge case of exactly 1000Hz sample rate", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_sample_rate: 1000,
      };

      const result = formatWavMetadata(metadata);
      expect(result).toBe("1.0kHz");
    });

    it("handles zero values gracefully", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 0,
        wav_channels: 0,
        wav_sample_rate: 0,
      };

      const result = formatWavMetadata(metadata);
      // Zero values are falsy, so they get filtered out, resulting in empty string
      expect(result).toBe("");
    });
  });

  describe("[UC-34] [Q-08] getCompatibilityStatus: the shared format rule (#576)", () => {
    const sample = (fields: Partial<SampleData>): SampleData => ({
      filename: "test.wav",
      source_path: "/path/test.wav",
      ...fields,
    });

    it("returns native for Rample-compatible formats", () => {
      expect(
        getCompatibilityStatus(
          sample({
            wav_bit_depth: 16,
            wav_channels: 1,
            wav_sample_rate: 44100,
          }),
        ),
      ).toBe("native");
      expect(
        getCompatibilityStatus(
          sample({ wav_bit_depth: 8, wav_channels: 1, wav_sample_rate: 44100 }),
        ),
      ).toBe("native");
    });

    it("returns convertible for 24-bit, 48 kHz and float (32-bit) files", () => {
      for (const fields of [
        { wav_bit_depth: 24, wav_channels: 1, wav_sample_rate: 44100 },
        { wav_bit_depth: 16, wav_channels: 1, wav_sample_rate: 48000 },
        { wav_bit_depth: 32, wav_channels: 1, wav_sample_rate: 44100 },
      ]) {
        expect(getCompatibilityStatus(sample(fields))).toBe("convertible");
      }
    });

    it("returns convertible, not incompatible, for more than two channels", () => {
      expect(
        getCompatibilityStatus(
          sample({
            wav_bit_depth: 16,
            wav_channels: 6,
            wav_sample_rate: 44100,
          }),
          { stereoVoice: true },
        ),
      ).toBe("convertible");
    });

    it("reads the voice's stereo setting: a stereo file on a mono voice is mixed down", () => {
      const stereo = sample({
        wav_bit_depth: 16,
        wav_channels: 2,
        wav_sample_rate: 44100,
      });
      expect(getCompatibilityStatus(stereo, { stereoVoice: true })).toBe(
        "native",
      );
      expect(getCompatibilityStatus(stereo, { stereoVoice: false })).toBe(
        "convertible",
      );
    });

    it("returns convertible for a native file with a gain adjustment", () => {
      expect(
        getCompatibilityStatus(
          sample({
            gain_db: -3,
            wav_bit_depth: 16,
            wav_channels: 1,
            wav_sample_rate: 44100,
          }),
        ),
      ).toBe("convertible");
    });

    it("returns null, not native, when the stored format is missing", () => {
      expect(getCompatibilityStatus(sample({}))).toBeNull();
      expect(getCompatibilityStatus(sample({ wav_bit_depth: 16 }))).toBeNull();
    });

    it("returns convertible when a known value already needs converting", () => {
      expect(getCompatibilityStatus(sample({ wav_sample_rate: 48000 }))).toBe(
        "convertible",
      );
    });
  });

  describe("getCompatibilityDisplay", () => {
    it("returns correct display info for native compatibility", () => {
      const result = getCompatibilityDisplay("native");
      expect(result).toEqual({
        colorClass: "text-green-600 dark:text-green-400",
        emoji: "✓",
        text: "Native",
      });
    });

    it("returns correct display info for convertible compatibility", () => {
      const result = getCompatibilityDisplay("convertible");
      expect(result).toEqual({
        colorClass: "text-yellow-600 dark:text-yellow-400",
        emoji: "🟡",
        text: "Convertible",
      });
    });
  });

  describe("formatTooltip", () => {
    it("formats complete tooltip with metadata and enhanced visual formatting", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_channels: 2,
        wav_sample_rate: 44100,
      };

      const result = formatTooltip(metadata, "/path/test.wav", "test.wav");
      expect(result).toBe(
        "test.wav\n/path/test.wav\n► 44.1kHz • 16-bit • Stereo • ✓ Native",
      );
    });

    it("shows only path when no metadata available", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
      };

      const result = formatTooltip(metadata, "/path/test.wav", "test.wav");
      expect(result).toBe("test.wav\n/path/test.wav");
    });

    it("handles convertible format correctly", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 24,
        wav_channels: 1,
        wav_sample_rate: 48000,
      };

      const result = formatTooltip(metadata, "/path/test.wav", "test.wav");
      expect(result).toBe(
        "test.wav\n/path/test.wav\n► 48.0kHz • 24-bit • Mono • 🟡 Convertible",
      );
    });

    it("shows a multichannel file as convertible", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_channels: 6,
        wav_sample_rate: 44100,
      };

      const result = formatTooltip(metadata, "/path/test.wav", "test.wav");
      expect(result).toBe(
        "test.wav\n/path/test.wav\n► 44.1kHz • 16-bit • 6ch • 🟡 Convertible",
      );
    });

    it("shows a stereo file on a mono voice as convertible", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_channels: 2,
        wav_sample_rate: 44100,
      };

      const result = formatTooltip(metadata, "/path/test.wav", "test.wav", {
        stereoVoice: false,
      });
      expect(result).toBe(
        "test.wav\n/path/test.wav\n► 44.1kHz • 16-bit • Stereo • 🟡 Convertible",
      );
    });

    it("leaves the status out when the stored format is incomplete", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_sample_rate: 44100,
      };

      const result = formatTooltip(metadata, "/path/test.wav", "test.wav");
      expect(result).toBe("test.wav\n/path/test.wav\n► 44.1kHz • 16-bit");
    });
  });
});
