import { describe, expect, it } from "vitest";

import * as scannerIndex from "../index";

describe("scanner index exports", () => {
  describe("orchestration function exports", () => {
    it("should export executeFullKitScan", () => {
      expect(scannerIndex.executeFullKitScan).toBeDefined();
      expect(typeof scannerIndex.executeFullKitScan).toBe("function");
    });

    it("should export executeVoiceInferenceScan", () => {
      expect(scannerIndex.executeVoiceInferenceScan).toBeDefined();
      expect(typeof scannerIndex.executeVoiceInferenceScan).toBe("function");
    });

    it("should export executeWAVAnalysisScan", () => {
      expect(scannerIndex.executeWAVAnalysisScan).toBeDefined();
      expect(typeof scannerIndex.executeWAVAnalysisScan).toBe("function");
    });
  });

  describe("orchestrator export", () => {
    it("should export ScannerOrchestrator", () => {
      expect(scannerIndex.ScannerOrchestrator).toBeDefined();
      expect(typeof scannerIndex.ScannerOrchestrator).toBe("function");
    });
  });

  describe("individual scanner exports", () => {
    it("should export scanRTFArtist", () => {
      expect(scannerIndex.scanRTFArtist).toBeDefined();
      expect(typeof scannerIndex.scanRTFArtist).toBe("function");
    });

    it("should export scanVoiceInference", () => {
      expect(scannerIndex.scanVoiceInference).toBeDefined();
      expect(typeof scannerIndex.scanVoiceInference).toBe("function");
    });

    it("should export scanWAVAnalysis", () => {
      expect(scannerIndex.scanWAVAnalysis).toBeDefined();
      expect(typeof scannerIndex.scanWAVAnalysis).toBe("function");
    });
  });

  describe("type exports", () => {
    it("should have all expected exports available", () => {
      // Test that the module has the expected structure
      const expectedExports = [
        "executeFullKitScan",
        "executeVoiceInferenceScan",
        "executeWAVAnalysisScan",
        "ScannerOrchestrator",
        "scanRTFArtist",
        "scanVoiceInference",
        "scanWAVAnalysis",
      ];

      expectedExports.forEach((exportName) => {
        expect(scannerIndex).toHaveProperty(exportName);
      });
    });

    it("should export function types", () => {
      // These are the main function exports that should be callable
      const functionExports = [
        "executeFullKitScan",
        "executeVoiceInferenceScan",
        "executeWAVAnalysisScan",
        "ScannerOrchestrator",
        "scanRTFArtist",
        "scanVoiceInference",
        "scanWAVAnalysis",
      ];

      functionExports.forEach((exportName) => {
        expect(
          typeof scannerIndex[exportName as keyof typeof scannerIndex]
        ).toBe("function");
      });
    });
  });
});
