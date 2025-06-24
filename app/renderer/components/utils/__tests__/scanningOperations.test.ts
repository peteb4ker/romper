// Tests for scanning operations

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  scanRTFArtist,
  scanVoiceInference,
  scanWAVAnalysis,
} from "../scannerOrchestrator";

// Mock the shared utility functions
vi.mock("../../../../../shared/kitUtilsShared", () => ({
  inferVoiceTypeFromFilename: vi.fn(),
  toCapitalCase: vi.fn((str: string) => str),
  groupSamplesByVoice: vi.fn(),
}));

// Import the mocked module to access the mock functions
import { inferVoiceTypeFromFilename } from "../../../../../shared/kitUtilsShared";

describe("scanVoiceInference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully infers voice names from sample filenames", () => {
    vi.mocked(inferVoiceTypeFromFilename).mockImplementation(
      (filename: string) => {
        if (filename.includes("kick")) return "Kick";
        if (filename.includes("snare")) return "Snare";
        if (filename.includes("hat")) return "Hat";
        if (filename.includes("tom")) return "Tom";
        return null;
      },
    );

    const input = {
      samples: {
        1: ["1 kick.wav", "1 another.wav"],
        2: ["2 snare.wav"],
        3: ["3 hat.wav", "3 extra.wav"],
        4: ["4 tom.wav"],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(true);
    expect(result.data?.voiceNames).toEqual({
      1: "Kick",
      2: "Snare",
      3: "Hat",
      4: "Tom",
    });
  });

  it("returns null for voices with no recognizable samples", () => {
    vi.mocked(inferVoiceTypeFromFilename).mockImplementation(
      (filename: string) => {
        if (filename.includes("kick")) return "Kick";
        return null; // Unknown samples
      },
    );

    const input = {
      samples: {
        1: ["1 kick.wav"],
        2: ["2 unknown.wav", "2 mystery.wav"],
        3: [],
        4: ["4 weird.wav"],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(true);
    expect(result.data?.voiceNames).toEqual({
      1: "Kick",
      2: null,
      3: null,
      4: null,
    });
  });

  it("uses first successful inference when multiple samples match", () => {
    vi.mocked(inferVoiceTypeFromFilename).mockImplementation(
      (filename: string) => {
        if (filename.includes("kick")) return "Kick";
        if (filename.includes("snare")) return "Snare";
        return null;
      },
    );

    const input = {
      samples: {
        1: ["1 unknown.wav", "1 kick.wav", "1 snare.wav"], // Should pick "Kick" (first match)
        2: [],
        3: [],
        4: [],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(true);
    expect(result.data?.voiceNames[1]).toBe("Kick");
  });

  it("handles empty samples object", () => {
    const input = {
      samples: {},
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(true);
    expect(result.data?.voiceNames).toEqual({
      1: null,
      2: null,
      3: null,
      4: null,
    });
  });

  it("handles missing voice numbers gracefully", () => {
    vi.mocked(inferVoiceTypeFromFilename).mockImplementation(
      (filename: string) => {
        if (filename.includes("kick")) return "Kick";
        return null;
      },
    );

    const input = {
      samples: {
        1: ["1 kick.wav"],
        // Missing voices 2, 3, 4
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(true);
    expect(result.data?.voiceNames).toEqual({
      1: "Kick",
      2: null,
      3: null,
      4: null,
    });
  });

  it("handles errors from inference function gracefully", () => {
    vi.mocked(inferVoiceTypeFromFilename).mockImplementation(() => {
      throw new Error("Inference failed");
    });

    const input = {
      samples: {
        1: ["1 kick.wav"],
        2: [],
        3: [],
        4: [],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Inference failed");
  });
});

describe("scanWAVAnalysis", () => {
  // Helper function to create mock WAV file buffers
  function createMockWAVBuffer({
    sampleRate = 44100,
    bitDepth = 16,
    channels = 2,
    valid = true,
  }): ArrayBuffer {
    if (!valid) {
      // Return invalid data
      return new ArrayBuffer(8);
    }

    const buffer = new ArrayBuffer(44); // Minimal WAV header size
    const view = new DataView(buffer);

    // RIFF header
    view.setUint8(0, 82); // 'R'
    view.setUint8(1, 73); // 'I'
    view.setUint8(2, 70); // 'F'
    view.setUint8(3, 70); // 'F'

    // File size (minus first 8 bytes)
    view.setUint32(4, 36, true);

    // WAVE header
    view.setUint8(8, 87); // 'W'
    view.setUint8(9, 65); // 'A'
    view.setUint8(10, 86); // 'V'
    view.setUint8(11, 69); // 'E'

    // fmt chunk header
    view.setUint8(12, 102); // 'f'
    view.setUint8(13, 109); // 'm'
    view.setUint8(14, 116); // 't'
    view.setUint8(15, 32); // ' '

    // fmt chunk size
    view.setUint32(16, 16, true);

    // Audio format (PCM = 1)
    view.setUint16(20, 1, true);

    // Number of channels
    view.setUint16(22, channels, true);

    // Sample rate
    view.setUint32(24, sampleRate, true);

    // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
    const byteRate = sampleRate * channels * (bitDepth / 8);
    view.setUint32(28, byteRate, true);

    // Block align (NumChannels * BitsPerSample/8)
    const blockAlign = channels * (bitDepth / 8);
    view.setUint16(32, blockAlign, true);

    // Bits per sample
    view.setUint16(34, bitDepth, true);

    return buffer;
  }

  it("successfully analyzes 16-bit stereo WAV at 44.1kHz", async () => {
    const mockFileReader = vi
      .fn()
      .mockResolvedValue(
        createMockWAVBuffer({ sampleRate: 44100, bitDepth: 16, channels: 2 }),
      );

    const input = {
      filePath: "/test/stereo.wav",
      fileReader: mockFileReader,
    };

    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      bitrate: 1411200, // 44100 * 16 * 2
      isStereo: true,
      isValid: true,
    });
  });

  it("successfully analyzes 24-bit mono WAV at 48kHz", async () => {
    const mockFileReader = vi
      .fn()
      .mockResolvedValue(
        createMockWAVBuffer({ sampleRate: 48000, bitDepth: 24, channels: 1 }),
      );

    const input = {
      filePath: "/test/mono.wav",
      fileReader: mockFileReader,
    };

    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      sampleRate: 48000,
      bitDepth: 24,
      channels: 1,
      bitrate: 1152000, // 48000 * 24 * 1
      isStereo: false,
      isValid: true,
    });
  });

  it("handles invalid WAV file format", async () => {
    const mockFileReader = vi
      .fn()
      .mockResolvedValue(createMockWAVBuffer({ valid: false }));

    const input = {
      filePath: "/test/invalid.wav",
      fileReader: mockFileReader,
    };

    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid WAV file format");
  });

  it("handles file reading errors", async () => {
    const mockFileReader = vi
      .fn()
      .mockRejectedValue(new Error("File not found"));

    const input = {
      filePath: "/test/missing.wav",
      fileReader: mockFileReader,
    };

    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("File not found");
  });

  it("correctly identifies stereo vs mono", async () => {
    // Test stereo
    const stereoReader = vi
      .fn()
      .mockResolvedValue(createMockWAVBuffer({ channels: 2 }));

    const stereoResult = await scanWAVAnalysis({
      filePath: "/test/stereo.wav",
      fileReader: stereoReader,
    });

    expect(stereoResult.data?.isStereo).toBe(true);

    // Test mono
    const monoReader = vi
      .fn()
      .mockResolvedValue(createMockWAVBuffer({ channels: 1 }));

    const monoResult = await scanWAVAnalysis({
      filePath: "/test/mono.wav",
      fileReader: monoReader,
    });

    expect(monoResult.data?.isStereo).toBe(false);
  });

  it("calculates bitrate correctly for various formats", async () => {
    const testCases = [
      { sampleRate: 44100, bitDepth: 16, channels: 1, expectedBitrate: 705600 },
      {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        expectedBitrate: 1411200,
      },
      {
        sampleRate: 48000,
        bitDepth: 24,
        channels: 1,
        expectedBitrate: 1152000,
      },
      {
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        expectedBitrate: 2304000,
      },
      {
        sampleRate: 96000,
        bitDepth: 24,
        channels: 2,
        expectedBitrate: 4608000,
      },
    ];

    for (const testCase of testCases) {
      const mockFileReader = vi
        .fn()
        .mockResolvedValue(createMockWAVBuffer(testCase));

      const result = await scanWAVAnalysis({
        filePath: "/test/sample.wav",
        fileReader: mockFileReader,
      });

      expect(result.success).toBe(true);
      expect(result.data?.bitrate).toBe(testCase.expectedBitrate);
    }
  });

  it("uses default file reader when none provided", async () => {
    // Mock the global window.electronAPI
    const originalElectronAPI = window.electronAPI;
    window.electronAPI = {
      ...window.electronAPI,
      getAudioBuffer: vi
        .fn()
        .mockResolvedValue(
          createMockWAVBuffer({ sampleRate: 44100, bitDepth: 16, channels: 2 }),
        ),
    };

    const input = {
      filePath: "/test/sample.wav",
      // No fileReader provided - should use default
    };

    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(window.electronAPI.getAudioBuffer).toHaveBeenCalledWith(
      "/test/sample.wav",
    );

    // Restore original
    window.electronAPI = originalElectronAPI;
  });

  it("handles missing Electron API gracefully", async () => {
    const originalElectronAPI = window.electronAPI;
    window.electronAPI = {
      ...window.electronAPI,
      getAudioBuffer: undefined,
    };

    const input = {
      filePath: "/test/sample.wav",
      // No fileReader provided, and no Electron API
    };

    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Electron API not available");

    // Restore original
    window.electronAPI = originalElectronAPI;
  });
});

describe("scanRTFArtist", () => {
  it("successfully extracts artist names from RTF filenames", () => {
    const input = {
      files: [
        "A - Squarp.rtf",
        "B - Roland.rtf",
        "C - Elektron.rtf",
        "kick.wav",
        "snare.wav",
        "other.txt",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({
      A: "Squarp",
      B: "Roland",
      C: "Elektron",
    });
  });

  it("handles artist names with spaces and underscores", () => {
    const input = {
      files: [
        "A - Native_Instruments.rtf",
        "B - Teenage Engineering.rtf",
        "C - sample_artist_name.rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({
      A: "Native Instruments",
      B: "Teenage Engineering",
      C: "Sample Artist Name",
    });
  });

  it("ignores non-RTF files and invalid patterns", () => {
    const input = {
      files: [
        "A - Valid Artist.rtf",
        "Invalid.rtf", // Missing pattern
        "A-NoSpaces.rtf", // Wrong pattern
        "1 - Invalid Bank.rtf", // Number instead of letter
        "AA - Too Long.rtf", // Multiple letters
        "kick.wav",
        "readme.txt",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({
      A: "Valid Artist",
    });
  });

  it("handles empty file list", () => {
    const input = {
      files: [],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({});
  });

  it("handles file list with no RTF files", () => {
    const input = {
      files: ["kick.wav", "snare.wav", "readme.txt", "config.json"],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({});
  });

  it("handles case-insensitive RTF extension", () => {
    const input = {
      files: [
        "A - Artist One.rtf",
        "B - Artist Two.RTF",
        "C - Artist Three.Rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({
      A: "Artist One",
      B: "Artist Two",
      C: "Artist Three",
    });
  });

  it("normalizes bank letters to uppercase", () => {
    const input = {
      files: [
        "a - Lowercase Bank.rtf",
        "B - Uppercase Bank.rtf",
        "z - Last Bank.rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({
      A: "Lowercase Bank",
      B: "Uppercase Bank",
      Z: "Last Bank",
    });
  });

  it("handles duplicate banks (last one wins)", () => {
    const input = {
      files: [
        "A - First Artist.rtf",
        "A - Second Artist.rtf", // Should overwrite first
        "B - Another Artist.rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({
      A: "Second Artist",
      B: "Another Artist",
    });
  });

  it("handles special characters in artist names", () => {
    const input = {
      files: [
        "A - Artist & Co.rtf",
        "B - DJ's Mix.rtf",
        "C - Company (2024).rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual({
      A: "Artist & Co",
      B: "DJ's Mix",
      C: "Company (2024)",
    });
  });

  it("handles all 26 possible banks", () => {
    const files = [];
    const expectedBanks: { [key: string]: string } = {};

    // Generate all banks A-Z
    for (let i = 0; i < 26; i++) {
      const bank = String.fromCharCode(65 + i); // A-Z
      const artist = `Artist ${bank}`;
      files.push(`${bank} - ${artist}.rtf`);
      expectedBanks[bank] = artist;
    }

    const input = { files };
    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data?.bankArtists).toEqual(expectedBanks);
    expect(Object.keys(result.data?.bankArtists || {})).toHaveLength(26);
  });
});
