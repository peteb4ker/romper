import { describe, expect, it } from "vitest";

import type {
  ChainResult,
  ErrorHandlingStrategy,
  FullKitScanInput,
  FullKitScanOutput,
  ProgressCallback,
  RTFArtistInput,
  RTFArtistOutput,
  ScannerFunction,
  ScanOperation,
  ScanResult,
  VoiceInferenceInput,
  VoiceInferenceOutput,
  WAVAnalysisInput,
  WAVAnalysisOutput,
} from "../types";

describe("scanner types", () => {
  describe("ChainResult interface", () => {
    it("should allow valid ChainResult objects", () => {
      const result: ChainResult = {
        completedOperations: 5,
        errors: [{ error: "test error", operation: "test op" }],
        results: { test: "data" },
        success: true,
        totalOperations: 10,
      };
      expect(result.completedOperations).toBe(5);
      expect(result.errors).toHaveLength(1);
      expect(result.results.test).toBe("data");
      expect(result.success).toBe(true);
      expect(result.totalOperations).toBe(10);
    });
  });

  describe("ErrorHandlingStrategy type", () => {
    it("should allow 'continue' value", () => {
      const strategy: ErrorHandlingStrategy = "continue";
      expect(strategy).toBe("continue");
    });

    it("should allow 'stop' value", () => {
      const strategy: ErrorHandlingStrategy = "stop";
      expect(strategy).toBe("stop");
    });
  });

  describe("FullKitScanInput interface", () => {
    it("should allow valid FullKitScanInput objects", () => {
      const input: FullKitScanInput = {
        samples: { 1: ["kick.wav"], 2: ["snare.wav"] },
        wavFiles: ["kick.wav", "snare.wav"],
      };
      expect(input.samples[1]).toEqual(["kick.wav"]);
      expect(input.wavFiles).toHaveLength(2);
    });

    it("should allow optional fileReader", () => {
      const mockFileReader = async (_filePath: string): Promise<ArrayBuffer> =>
        new ArrayBuffer(0);
      const input: FullKitScanInput = {
        fileReader: mockFileReader,
        samples: {},
        wavFiles: [],
      };
      expect(typeof input.fileReader).toBe("function");
    });
  });

  describe("FullKitScanOutput interface", () => {
    it("should allow optional properties", () => {
      const output: FullKitScanOutput = {};
      expect(output.voiceInference).toBeUndefined();
      expect(output.wavAnalysis).toBeUndefined();

      const outputWithData: FullKitScanOutput = {
        voiceInference: { voiceNames: { 1: "kick" } },
        wavAnalysis: [
          {
            bitDepth: 16,
            bitrate: 1411,
            channels: 2,
            isStereo: true,
            isValid: true,
            sampleRate: 44100,
          },
        ],
      };
      expect(outputWithData.voiceInference?.voiceNames[1]).toBe("kick");
      expect(outputWithData.wavAnalysis).toHaveLength(1);
    });
  });

  describe("ProgressCallback type", () => {
    it("should allow valid progress callback functions", () => {
      const callback: ProgressCallback = (completed, total, operation) => {
        expect(typeof completed).toBe("number");
        expect(typeof total).toBe("number");
        expect(typeof operation).toBe("string");
      };
      callback(5, 10, "test operation");
    });
  });

  describe("RTFArtistInput interface", () => {
    it("should allow valid RTFArtistInput objects", () => {
      const input: RTFArtistInput = {
        rtfFiles: ["bank1.rtf", "bank2.rtf"],
      };
      expect(input.rtfFiles).toHaveLength(2);
      expect(input.rtfFiles[0]).toBe("bank1.rtf");
    });
  });

  describe("RTFArtistOutput interface", () => {
    it("should allow valid RTFArtistOutput objects", () => {
      const output: RTFArtistOutput = {
        bankArtists: { bank1: "Artist 1", bank2: "Artist 2" },
      };
      expect(output.bankArtists["bank1"]).toBe("Artist 1");
      expect(Object.keys(output.bankArtists)).toHaveLength(2);
    });
  });

  describe("ScannerFunction type", () => {
    it("should allow synchronous scanner functions", () => {
      const syncScanner: ScannerFunction<string, number> = (input: string) => ({
        data: input.length,
        success: true,
      });
      const result = syncScanner("test");
      expect(result.data).toBe(4);
      expect(result.success).toBe(true);
    });

    it("should allow asynchronous scanner functions", () => {
      const asyncScanner: ScannerFunction<string, number> = async (
        input: string
      ) => ({
        data: input.length,
        success: true,
      });
      expect(asyncScanner("test")).toBeInstanceOf(Promise);
    });
  });

  describe("ScanOperation interface", () => {
    it("should allow valid ScanOperation objects", () => {
      const operation: ScanOperation<string, number> = {
        input: "test input",
        name: "test operation",
        scanner: (input) => ({ data: input.length, success: true }),
      };
      expect(operation.input).toBe("test input");
      expect(operation.name).toBe("test operation");
      expect(typeof operation.scanner).toBe("function");
    });
  });

  describe("ScanResult interface", () => {
    it("should allow successful results", () => {
      const result: ScanResult<string> = {
        data: "test data",
        success: true,
      };
      expect(result.data).toBe("test data");
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should allow error results", () => {
      const result: ScanResult = {
        error: "something went wrong",
        success: false,
      };
      expect(result.error).toBe("something went wrong");
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    });
  });

  describe("VoiceInferenceInput interface", () => {
    it("should allow valid VoiceInferenceInput objects", () => {
      const input: VoiceInferenceInput = {
        samples: {
          1: ["kick1.wav", "kick2.wav"],
          2: ["snare.wav"],
          3: ["hihat.wav"],
          4: [],
        },
      };
      expect(input.samples[1]).toHaveLength(2);
      expect(input.samples[4]).toHaveLength(0);
    });
  });

  describe("VoiceInferenceOutput interface", () => {
    it("should allow valid VoiceInferenceOutput objects", () => {
      const output: VoiceInferenceOutput = {
        voiceNames: {
          1: "kick",
          2: "snare",
          3: "hihat",
          4: "percussion",
        },
      };
      expect(output.voiceNames[1]).toBe("kick");
      expect(Object.keys(output.voiceNames)).toHaveLength(4);
    });
  });

  describe("WAVAnalysisInput interface", () => {
    it("should allow valid WAVAnalysisInput objects", () => {
      const input: WAVAnalysisInput = {
        filePath: "/path/to/sample.wav",
      };
      expect(input.filePath).toBe("/path/to/sample.wav");
      expect(input.fileReader).toBeUndefined();
      expect(input.wavData).toBeUndefined();
    });

    it("should allow optional properties", () => {
      const mockFileReader = async (): Promise<ArrayBuffer> =>
        new ArrayBuffer(0);
      const mockWavData = new ArrayBuffer(1024);
      const input: WAVAnalysisInput = {
        filePath: "/path/to/sample.wav",
        fileReader: mockFileReader,
        wavData: mockWavData,
      };
      expect(typeof input.fileReader).toBe("function");
      expect(input.wavData).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe("WAVAnalysisOutput interface", () => {
    it("should allow valid WAVAnalysisOutput objects", () => {
      const output: WAVAnalysisOutput = {
        bitDepth: 24,
        bitrate: 2116,
        channels: 2,
        isStereo: true,
        isValid: true,
        sampleRate: 44100,
      };
      expect(output.bitDepth).toBe(24);
      expect(output.bitrate).toBe(2116);
      expect(output.channels).toBe(2);
      expect(output.isStereo).toBe(true);
      expect(output.isValid).toBe(true);
      expect(output.sampleRate).toBe(44100);
    });

    it("should allow mono samples", () => {
      const output: WAVAnalysisOutput = {
        bitDepth: 16,
        bitrate: 705,
        channels: 1,
        isStereo: false,
        isValid: true,
        sampleRate: 44100,
      };
      expect(output.channels).toBe(1);
      expect(output.isStereo).toBe(false);
    });
  });
});
