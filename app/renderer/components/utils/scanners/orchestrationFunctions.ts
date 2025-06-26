// Orchestration functions - high-level scanning operations

import {
  scanRTFArtist,
  scanVoiceInference,
  scanWAVAnalysis,
} from "../scannerOperations";
import { ScannerOrchestrator } from "./orchestrator";
import type {
  ChainResult,
  ErrorHandlingStrategy,
  FullKitScanInput,
  ProgressCallback,
  RTFArtistInput,
  VoiceInferenceInput,
  WAVAnalysisInput,
  WAVAnalysisOutput,
} from "./types";

/**
 * Executes a full kit scan including voice inference, WAV analysis, and RTF artist scanning
 * @param kitData Kit data containing samples, WAV files, and RTF files
 * @param progressCallback Optional progress callback
 * @param errorStrategy Error handling strategy (default: "continue")
 * @returns Combined scan results
 */
export async function executeFullKitScan(
  kitData: FullKitScanInput,
  progressCallback?: ProgressCallback,
  errorStrategy: ErrorHandlingStrategy = "continue",
): Promise<ChainResult> {
  const orchestrator = new ScannerOrchestrator(progressCallback, errorStrategy);

  const operations = [
    {
      name: "voiceInference",
      scanner: scanVoiceInference,
      input: { samples: kitData.samples } as VoiceInferenceInput,
    },
    {
      name: "wavAnalysis",
      scanner: async (input: {
        wavFiles: string[];
        fileReader?: (filePath: string) => Promise<ArrayBuffer>;
      }) => {
        const { wavFiles, fileReader } = input;
        const results: WAVAnalysisOutput[] = [];
        const errors: string[] = [];

        for (const filePath of wavFiles) {
          const result = await scanWAVAnalysis({ filePath, fileReader });
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(result.error || "Unknown error");
          }
        }

        // If any files failed, the entire operation fails
        if (errors.length > 0) {
          return {
            success: false,
            error: `WAV analysis failed for ${errors.length} file(s): ${errors.join(", ")}`,
          };
        }

        return {
          success: true,
          data: results,
        };
      },
      input: { wavFiles: kitData.wavFiles, fileReader: kitData.fileReader },
    },
    {
      name: "rtfArtist",
      scanner: scanRTFArtist,
      input: { rtfFiles: kitData.rtfFiles } as RTFArtistInput,
    },
  ];

  return await orchestrator.executeChain(operations);
}

/**
 * Executes voice inference scanning only
 * @param samples Sample files grouped by voice number
 * @param progressCallback Optional progress callback
 * @param errorStrategy Error handling strategy (default: "continue")
 * @returns Voice inference results
 */
export async function executeVoiceInferenceScan(
  samples: Record<number, string[]>,
  progressCallback?: ProgressCallback,
  errorStrategy: ErrorHandlingStrategy = "continue",
): Promise<ChainResult> {
  const orchestrator = new ScannerOrchestrator(progressCallback, errorStrategy);

  const operations = [
    {
      name: "voiceInference",
      scanner: scanVoiceInference,
      input: { samples } as VoiceInferenceInput,
    },
  ];

  return await orchestrator.executeChain(operations);
}

/**
 * Executes WAV analysis scanning only
 * @param wavFiles Array of WAV file paths
 * @param fileReader Optional custom file reader
 * @param progressCallback Optional progress callback
 * @param errorStrategy Error handling strategy (default: "continue")
 * @returns WAV analysis results
 */
export async function executeWAVAnalysisScan(
  wavFiles: string[],
  fileReader?: (filePath: string) => Promise<ArrayBuffer>,
  progressCallback?: ProgressCallback,
  errorStrategy: ErrorHandlingStrategy = "continue",
): Promise<ChainResult> {
  const orchestrator = new ScannerOrchestrator(progressCallback, errorStrategy);

  const operations = [
    {
      name: "wavAnalysis",
      scanner: async (input: {
        wavFiles: string[];
        fileReader?: (filePath: string) => Promise<ArrayBuffer>;
      }) => {
        const { wavFiles, fileReader } = input;
        const results: WAVAnalysisOutput[] = [];
        const errors: string[] = [];

        for (const filePath of wavFiles) {
          const result = await scanWAVAnalysis({ filePath, fileReader });
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(result.error || "Unknown error");
          }
        }

        if (results.length === 0) {
          return {
            success: false,
            error: `WAV analysis failed for all files: ${errors.join(", ")}`,
          };
        }

        return {
          success: true,
          data: results,
        };
      },
      input: { wavFiles, fileReader },
    },
  ];

  return await orchestrator.executeChain(operations);
}

/**
 * Executes RTF artist scanning only
 * @param rtfFiles Array of RTF file paths
 * @param progressCallback Optional progress callback
 * @param errorStrategy Error handling strategy (default: "continue")
 * @returns RTF artist results
 */
export async function executeRTFArtistScan(
  rtfFiles: string[],
  progressCallback?: ProgressCallback,
  errorStrategy: ErrorHandlingStrategy = "continue",
): Promise<ChainResult> {
  const orchestrator = new ScannerOrchestrator(progressCallback, errorStrategy);

  const operations = [
    {
      name: "rtfArtist",
      scanner: scanRTFArtist,
      input: { rtfFiles } as RTFArtistInput,
    },
  ];

  return await orchestrator.executeChain(operations);
}
