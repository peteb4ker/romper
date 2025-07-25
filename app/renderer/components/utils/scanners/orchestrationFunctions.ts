// Orchestration functions - high-level scanning operations

import { scanVoiceInference, scanWAVAnalysis } from "../scannerOperations";
import { ScannerOrchestrator } from "./orchestrator";
import type {
  ChainResult,
  ErrorHandlingStrategy,
  FullKitScanInput,
  ProgressCallback,
  VoiceInferenceInput,
  WAVAnalysisInput,
  WAVAnalysisOutput,
} from "./types";

/**
 * Executes a full kit scan including voice inference and WAV analysis
 * @param kitData Kit data containing samples and WAV files
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
          try {
            if (!fileReader) {
              throw new Error("No file reader provided");
            }

            const wavData = await fileReader(filePath);
            const analysis = await scanWAVAnalysis({
              wavData,
              filePath,
              fileReader,
            });

            if (analysis.success && analysis.data) {
              results.push(analysis.data);
            } else {
              errors.push(
                `Failed to analyze ${filePath}: ${
                  analysis.error || "Unknown error"
                }`,
              );
            }
          } catch (error) {
            errors.push(
              `Error processing ${filePath}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        if (errors.length > 0 && errors.length === wavFiles.length) {
          return {
            success: false,
            error: `All WAV files failed analysis: ${errors.slice(0, 3).join("; ")}${
              errors.length > 3 ? "..." : ""
            }`,
          };
        }

        return {
          success: true,
          data: results,
        };
      },
      input: { wavFiles: kitData.wavFiles, fileReader: kitData.fileReader },
    },
  ];

  return await orchestrator.executeChain(operations);
}

/**
 * Executes voice inference scanning only
 * @param samples Sample data by voice
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
 * @param fileReader File reader function
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
          try {
            if (!fileReader) {
              throw new Error("No file reader provided");
            }

            const wavData = await fileReader(filePath);
            const analysis = await scanWAVAnalysis({
              wavData,
              filePath,
              fileReader,
            });

            if (analysis.success && analysis.data) {
              results.push(analysis.data);
            } else {
              errors.push(
                `Failed to analyze ${filePath}: ${
                  analysis.error || "Unknown error"
                }`,
              );
            }
          } catch (error) {
            errors.push(
              `Error processing ${filePath}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        if (errors.length > 0 && errors.length === wavFiles.length) {
          return {
            success: false,
            error: `All WAV files failed analysis: ${errors.slice(0, 3).join("; ")}${
              errors.length > 3 ? "..." : ""
            }`,
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
