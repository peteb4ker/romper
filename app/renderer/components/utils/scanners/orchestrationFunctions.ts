// Orchestration functions - high-level scanning operations

import type {
  ChainResult,
  ErrorHandlingStrategy,
  FullKitScanInput,
  ProgressCallback,
  VoiceInferenceInput,
  WAVAnalysisOutput,
} from "./types";

import { scanVoiceInference, scanWAVAnalysis } from "../scannerOperations";
import { ScannerOrchestrator } from "./orchestrator";

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
      input: { samples: kitData.samples } as VoiceInferenceInput,
      name: "voiceInference",
      scanner: scanVoiceInference,
    },
    {
      input: {},
      name: "wavAnalysis",
      scanner: createWAVAnalysisScanner(kitData.wavFiles, kitData.fileReader),
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
      input: { samples } as VoiceInferenceInput,
      name: "voiceInference",
      scanner: scanVoiceInference,
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
      input: {},
      name: "wavAnalysis",
      scanner: createWAVAnalysisScanner(wavFiles, fileReader),
    },
  ];

  return await orchestrator.executeChain(operations);
}

/**
 * Creates a WAV analysis scanner function
 * @param wavFiles Array of WAV file paths
 * @param fileReader File reader function
 * @returns Scanner function for WAV analysis
 */
function createWAVAnalysisScanner(
  wavFiles: string[],
  fileReader?: (filePath: string) => Promise<ArrayBuffer>,
) {
  return async () => {
    const results: WAVAnalysisOutput[] = [];
    const errors: string[] = [];

    // Check fileReader once before the loop
    const hasFileReader = !!fileReader;

    for (const filePath of wavFiles) {
      try {
        if (!hasFileReader) {
          throw new Error("No file reader provided");
        }

        const wavData = await fileReader(filePath);
        const analysis = await scanWAVAnalysis({
          filePath,
          fileReader,
          wavData,
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
        error: formatAllFailedError(errors),
        success: false,
      };
    }

    return {
      data: results,
      success: true,
    };
  };
}

/**
 * Formats error message when all WAV files fail analysis
 * @param errors Array of error messages
 * @returns Formatted error message
 */
function formatAllFailedError(errors: string[]): string {
  const displayErrors = errors.slice(0, 3).join("; ");
  const suffix = errors.length > 3 ? "..." : "";
  return `All WAV files failed analysis: ${displayErrors}${suffix}`;
}
