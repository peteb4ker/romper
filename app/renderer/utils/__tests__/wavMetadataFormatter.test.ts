import { describe, expect, it } from "vitest";

import type { SampleData } from "../components/kitTypes";

import {
  formatEnhancedTooltip,
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
  });

  describe("getCompatibilityStatus", () => {
    it("returns native for Rample-compatible formats", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_channels: 2,
        wav_sample_rate: 44100,
      };

      const result = getCompatibilityStatus(metadata);
      expect(result).toBe("native");
    });

    it("returns convertible for non-native but convertible formats", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 24,
        wav_channels: 1,
        wav_sample_rate: 48000,
      };

      const result = getCompatibilityStatus(metadata);
      expect(result).toBe("convertible");
    });

    it("returns incompatible for multi-channel formats", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_channels: 6,
        wav_sample_rate: 44100,
      };

      const result = getCompatibilityStatus(metadata);
      expect(result).toBe("incompatible");
    });

    it("returns native for missing metadata (backward compatibility)", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
      };

      const result = getCompatibilityStatus(metadata);
      expect(result).toBe("native");
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

    it("returns correct display info for incompatible format", () => {
      const result = getCompatibilityDisplay("incompatible");
      expect(result).toEqual({
        colorClass: "text-red-600 dark:text-red-400",
        emoji: "❌",
        text: "Incompatible",
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
  });

  describe("formatEnhancedTooltip", () => {
    it("formats enhanced tooltip with separated technical specs", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 16,
        wav_channels: 2,
        wav_sample_rate: 44100,
      };

      const result = formatEnhancedTooltip(
        metadata,
        "/path/test.wav",
        "test.wav",
      );
      expect(result).toBe(
        "📄 test.wav\n📁 /path/test.wav\n⚡ 44.1kHz • 🔢 16-bit • 🎛️ Stereo\n🎯 Status: ✓ Native",
      );
    });

    it("handles partial metadata in enhanced format", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
        wav_bit_depth: 24,
        wav_sample_rate: 48000,
      };

      const result = formatEnhancedTooltip(
        metadata,
        "/path/test.wav",
        "test.wav",
      );
      expect(result).toBe(
        "📄 test.wav\n📁 /path/test.wav\n⚡ 48.0kHz • 🔢 24-bit\n🎯 Status: ✓ Native",
      );
    });

    it("shows only filename and path when no technical metadata available", () => {
      const metadata: SampleData = {
        filename: "test.wav",
        source_path: "/path/test.wav",
      };

      const result = formatEnhancedTooltip(
        metadata,
        "/path/test.wav",
        "test.wav",
      );
      expect(result).toBe("📄 test.wav\n📁 /path/test.wav");
    });
  });
});
