// Tests for voice inference scanner

import { beforeEach, describe, expect, it, vi } from "vitest";

import { scanVoiceInference } from "../voiceInferenceScanner";

// Mock the shared utilities
vi.mock("@romper/shared/kitUtilsShared", () => ({
  inferVoiceTypeFromFilename: vi.fn(),
}));

import { inferVoiceTypeFromFilename } from "@romper/shared/kitUtilsShared";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scanVoiceInference", () => {
  it("successfully infers voice types from filenames", () => {
    vi.mocked(inferVoiceTypeFromFilename)
      .mockReturnValueOnce("Kick")
      .mockReturnValueOnce("Snare")
      .mockReturnValueOnce("Hat")
      .mockReturnValueOnce("Tom");

    const input = {
      samples: {
        1: ["kick.wav"],
        2: ["snare.wav"],
        3: ["hat.wav"],
        4: ["tom.wav"],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" },
    });

    expect(inferVoiceTypeFromFilename).toHaveBeenCalledWith("kick.wav");
    expect(inferVoiceTypeFromFilename).toHaveBeenCalledWith("snare.wav");
    expect(inferVoiceTypeFromFilename).toHaveBeenCalledWith("hat.wav");
    expect(inferVoiceTypeFromFilename).toHaveBeenCalledWith("tom.wav");
  });

  it("handles empty samples input", () => {
    const input = { samples: {} };
    const result = scanVoiceInference(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "No voice types could be inferred from filenames",
    );
  });

  it("handles samples with empty arrays", () => {
    const input = {
      samples: {
        1: [],
        2: [],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "No voice types could be inferred from filenames",
    );
  });

  it("handles failed voice type inference", () => {
    vi.mocked(inferVoiceTypeFromFilename).mockReturnValue(null);

    const input = {
      samples: {
        1: ["unknown.wav"],
        2: ["mystery.wav"],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "No voice types could be inferred from filenames",
    );
  });

  it("handles partial voice type inference success", () => {
    vi.mocked(inferVoiceTypeFromFilename)
      .mockReturnValueOnce("Kick")
      .mockReturnValueOnce(null);

    const input = {
      samples: {
        1: ["kick.wav"],
        2: ["unknown.wav"],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      voiceNames: { 1: "Kick" },
    });
  });

  it("handles exceptions during inference", () => {
    vi.mocked(inferVoiceTypeFromFilename).mockImplementation(() => {
      throw new Error("Inference error");
    });

    const input = {
      samples: { 1: ["test.wav"] },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Inference error");
  });

  it("uses first file in voice for inference", () => {
    vi.mocked(inferVoiceTypeFromFilename).mockReturnValue("Kick");

    const input = {
      samples: {
        1: ["1kick.wav", "1kick2.wav", "1kick3.wav"],
      },
    };

    const result = scanVoiceInference(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      voiceNames: { 1: "Kick" },
    });

    // Should only call with the first file
    expect(inferVoiceTypeFromFilename).toHaveBeenCalledTimes(1);
    expect(inferVoiceTypeFromFilename).toHaveBeenCalledWith("1kick.wav");
  });
});
