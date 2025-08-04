import { describe, expect, it } from "vitest";

import {
  scanRTFArtist,
  scanVoiceInference,
  scanWAVAnalysis,
} from "../scanningOperations";

describe("scanningOperations", () => {
  it("should export scanRTFArtist function", () => {
    expect(typeof scanRTFArtist).toBe("function");
  });

  it("should export scanVoiceInference function", () => {
    expect(typeof scanVoiceInference).toBe("function");
  });

  it("should export scanWAVAnalysis function", () => {
    expect(typeof scanWAVAnalysis).toBe("function");
  });
});
