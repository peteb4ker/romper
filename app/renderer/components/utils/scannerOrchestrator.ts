// Scanner orchestration system with composable operation chains

import { inferVoiceTypeFromFilename } from "../../../../shared/kitUtilsShared";

// Common scanner result interface
export interface ScannerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Voice inference scanner types
export interface VoiceInferenceInput {
  samples: { [voice: number]: string[] };
}

export interface VoiceInferenceOutput {
  voiceNames: { [voice: number]: string | null };
}

// WAV analysis scanner types
export interface WAVAnalysisInput {
  filePath: string;
  fileReader?: (filePath: string) => Promise<ArrayBuffer>; // Injectable for testing
}

export interface WAVAnalysisOutput {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  bitrate: number;
  isStereo: boolean;
  isValid: boolean;
}

// RTF artist metadata scanner types
export interface RTFArtistInput {
  files: string[]; // Array of filenames from directory listing
}

export interface RTFArtistOutput {
  bankArtists: { [bank: string]: string }; // Bank letter to artist name mapping
}

// Generic scanner function type
export type ScannerFunction<TInput, TOutput> = (
  input: TInput,
) => Promise<ScannerResult<TOutput>> | ScannerResult<TOutput>;

// Progress callback for tracking orchestration progress
export type ProgressCallback = (
  completed: number,
  total: number,
  operation: string,
) => void;

// Error handling strategy for failed operations
export type ErrorStrategy = "stop" | "continue";

// Result of an orchestration operation
export interface OrchestrationResult<T> {
  success: boolean;
  results: T;
  errors: Array<{ operation: string; error: string }>;
  completedOperations: number;
  totalOperations: number;
}

// Base orchestrator class for composable scanner chains
export class ScannerOrchestrator {
  private progressCallback?: ProgressCallback;
  private errorStrategy: ErrorStrategy = "continue";

  constructor(
    progressCallback?: ProgressCallback,
    errorStrategy: ErrorStrategy = "continue",
  ) {
    this.progressCallback = progressCallback;
    this.errorStrategy = errorStrategy;
  }

  /**
   * Execute a chain of scanner operations in sequence
   *
   * @param operations Array of operations to execute
   * @returns Orchestration result with all operation results
   */
  async executeChain<T extends Record<string, any>>(
    operations: Array<{
      name: string;
      scanner: ScannerFunction<any, any>;
      input: any;
    }>,
  ): Promise<OrchestrationResult<T>> {
    const results = {} as T;
    const errors: Array<{ operation: string; error: string }> = [];
    let completedOperations = 0;
    const totalOperations = operations.length;

    for (const operation of operations) {
      try {
        this.reportProgress(
          completedOperations,
          totalOperations,
          operation.name,
        );

        const result = await operation.scanner(operation.input);

        if (result.success && result.data) {
          // Store the successful result
          (results as any)[operation.name] = result.data;
          completedOperations++;
        } else {
          // Handle scanner failure
          const error = result.error || "Unknown error";
          errors.push({ operation: operation.name, error });

          if (this.errorStrategy === "stop") {
            break;
          }
        }
      } catch (error) {
        // Handle unexpected errors
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        errors.push({ operation: operation.name, error: errorMessage });

        if (this.errorStrategy === "stop") {
          break;
        }
      }
    }

    // Report final progress
    this.reportProgress(completedOperations, totalOperations, "Complete");

    return {
      success: errors.length === 0,
      results,
      errors,
      completedOperations,
      totalOperations,
    };
  }

  private reportProgress(
    completed: number,
    total: number,
    operation: string,
  ): void {
    if (this.progressCallback) {
      this.progressCallback(completed, total, operation);
    }
  }
}

// === SCANNING OPERATIONS ===

/**
 * Voice Name Inference Scanner
 *
 * Analyzes sample filenames to infer voice types (Kick, Snare, Hat, etc.)
 * Uses the existing voice inference logic from kitUtilsShared.ts
 *
 * @param input - Object containing samples organized by voice number
 * @returns Scanner result with inferred voice names
 */
export function scanVoiceInference(
  input: VoiceInferenceInput,
): ScannerResult<VoiceInferenceOutput> {
  try {
    const voiceNames: { [voice: number]: string | null } = {};

    // Process each voice (1-4)
    for (let voice = 1; voice <= 4; voice++) {
      const samplesForVoice = input.samples[voice] || [];
      let inferredName: string | null = null;

      // Try to infer voice type from each sample filename
      for (const sample of samplesForVoice) {
        const type = inferVoiceTypeFromFilename(sample);
        if (type) {
          inferredName = type;
          break; // Use the first successful inference
        }
      }

      voiceNames[voice] = inferredName;
    }

    return {
      success: true,
      data: { voiceNames },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * WAV File Analysis Scanner
 *
 * Analyzes WAV file headers to extract metadata including sample rate,
 * bit depth, channel count, and calculated bitrate
 *
 * @param input - Object containing file path and optional file reader
 * @returns Scanner result with WAV metadata
 */
export async function scanWAVAnalysis(
  input: WAVAnalysisInput,
): Promise<ScannerResult<WAVAnalysisOutput>> {
  try {
    const fileReader = input.fileReader || defaultFileReader;
    const buffer = await fileReader(input.filePath);

    const wavData = parseWAVHeader(buffer);

    if (!wavData.isValid) {
      return {
        success: false,
        error: "Invalid WAV file format",
      };
    }

    const bitrate = wavData.sampleRate * wavData.bitDepth * wavData.channels;

    return {
      success: true,
      data: {
        sampleRate: wavData.sampleRate,
        bitDepth: wavData.bitDepth,
        channels: wavData.channels,
        bitrate,
        isStereo: wavData.channels === 2,
        isValid: wavData.isValid,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * RTF Artist Metadata Scanner
 *
 * Analyzes RTF filenames to extract bank artist information
 * Looks for files matching pattern: "A - Artist Name.rtf"
 * Extracts artist names from filename (not file contents)
 *
 * @param input - Object containing array of filenames
 * @returns Scanner result with bank to artist mapping
 */
export function scanRTFArtist(
  input: RTFArtistInput,
): ScannerResult<RTFArtistOutput> {
  try {
    const bankArtists: { [bank: string]: string } = {};

    // Filter files matching RTF pattern: "A - Artist Name.rtf"
    const rtfFiles = input.files.filter((f: string) =>
      /^[A-Z] - .+\.rtf$/i.test(f),
    );

    // Extract bank and artist name from each RTF filename
    for (const file of rtfFiles) {
      const match = /^([A-Z]) - (.+)\.rtf$/i.exec(file);
      if (match) {
        const bank = match[1].toUpperCase();
        const artistName = capitalizeArtistName(match[2]);
        bankArtists[bank] = artistName;
      }
    }

    return {
      success: true,
      data: { bankArtists },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// === HELPER FUNCTIONS ===

/**
 * Default file reader using Electron IPC
 * Can be overridden for testing
 */
async function defaultFileReader(filePath: string): Promise<ArrayBuffer> {
  if (!window.electronAPI?.getAudioBuffer) {
    throw new Error("Electron API not available");
  }
  return await window.electronAPI.getAudioBuffer(filePath);
}

/**
 * Parse WAV file header to extract format information
 * Supports standard PCM WAV files
 */
function parseWAVHeader(buffer: ArrayBuffer): {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  isValid: boolean;
} {
  const view = new DataView(buffer);

  try {
    // Check RIFF header
    const riffHeader = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );

    if (riffHeader !== "RIFF") {
      return { sampleRate: 0, bitDepth: 0, channels: 0, isValid: false };
    }

    // Check WAVE format
    const waveHeader = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    );

    if (waveHeader !== "WAVE") {
      return { sampleRate: 0, bitDepth: 0, channels: 0, isValid: false };
    }

    // Find fmt chunk
    let offset = 12;
    while (offset < buffer.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3),
      );

      const chunkSize = view.getUint32(offset + 4, true); // little-endian

      if (chunkId === "fmt ") {
        // Found format chunk
        const audioFormat = view.getUint16(offset + 8, true);
        const channels = view.getUint16(offset + 10, true);
        const sampleRate = view.getUint32(offset + 12, true);
        const bitDepth = view.getUint16(offset + 22, true);

        // Only support PCM format (1)
        if (audioFormat !== 1) {
          return { sampleRate: 0, bitDepth: 0, channels: 0, isValid: false };
        }

        return {
          sampleRate,
          bitDepth,
          channels,
          isValid: true,
        };
      }

      // Move to next chunk
      offset += 8 + chunkSize;
    }

    // fmt chunk not found
    return { sampleRate: 0, bitDepth: 0, channels: 0, isValid: false };
  } catch (error) {
    return { sampleRate: 0, bitDepth: 0, channels: 0, isValid: false };
  }
}

/**
 * Capitalize artist name (simple version of toCapitalCase for artist names)
 * Converts underscores to spaces and capitalizes each word
 */
function capitalizeArtistName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b[a-zA-Z]/g, (c, index, str) => {
      // Don't capitalize after an apostrophe unless it's the start of a new word
      if (index > 0 && str[index - 1] === "'") {
        return c.toLowerCase();
      }
      return c.toUpperCase();
    })
    .replace(/\.$/, "") // Remove trailing dot
    .trim();
}

// === ORCHESTRATION FUNCTIONS ===

/**
 * Execute full kit scanning chain: voice inference → WAV analysis → RTF artist scan
 *
 * @param kitData Input data for all scanning operations
 * @param progressCallback Optional progress tracking callback
 * @param errorStrategy How to handle individual scanner failures
 * @returns Combined results from all scanners
 */
export async function executeFullKitScan(
  kitData: {
    samples: { [voice: number]: string[] };
    wavFiles: string[];
    rtfFiles: string[];
    fileReader?: (filePath: string) => Promise<ArrayBuffer>;
  },
  progressCallback?: ProgressCallback,
  errorStrategy: ErrorStrategy = "continue",
): Promise<
  OrchestrationResult<{
    voiceInference?: VoiceInferenceOutput;
    wavAnalysis?: WAVAnalysisOutput[];
    rtfArtist?: RTFArtistOutput;
  }>
> {
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
        files: string[];
        fileReader?: (filePath: string) => Promise<ArrayBuffer>;
      }) => {
        const results: WAVAnalysisOutput[] = [];
        const errors: string[] = [];

        for (const filePath of input.files) {
          const result = await scanWAVAnalysis({
            filePath,
            fileReader: input.fileReader,
          });

          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(`Failed to analyze ${filePath}: ${result.error}`);
          }
        }

        if (errors.length > 0) {
          return {
            success: false,
            error: `WAV analysis errors: ${errors.join(", ")}`,
          };
        }

        return {
          success: true,
          data: results,
        };
      },
      input: {
        files: kitData.wavFiles,
        fileReader: kitData.fileReader,
      },
    },
    {
      name: "rtfArtist",
      scanner: scanRTFArtist,
      input: { files: kitData.rtfFiles } as RTFArtistInput,
    },
  ];

  return orchestrator.executeChain(operations);
}

/**
 * Execute voice inference only
 *
 * @param samples Sample data organized by voice
 * @param progressCallback Optional progress tracking callback
 * @returns Voice inference results
 */
export async function executeVoiceInferenceScan(
  samples: { [voice: number]: string[] },
  progressCallback?: ProgressCallback,
): Promise<OrchestrationResult<{ voiceInference?: VoiceInferenceOutput }>> {
  const orchestrator = new ScannerOrchestrator(progressCallback, "stop");

  const operations = [
    {
      name: "voiceInference",
      scanner: scanVoiceInference,
      input: { samples } as VoiceInferenceInput,
    },
  ];

  return orchestrator.executeChain(operations);
}

/**
 * Execute WAV analysis for multiple files
 *
 * @param wavFiles Array of WAV file paths to analyze
 * @param fileReader Optional file reader function for testing
 * @param progressCallback Optional progress tracking callback
 * @returns WAV analysis results for all files
 */
export async function executeWAVAnalysisScan(
  wavFiles: string[],
  fileReader?: (filePath: string) => Promise<ArrayBuffer>,
  progressCallback?: ProgressCallback,
): Promise<OrchestrationResult<{ wavAnalysis?: WAVAnalysisOutput[] }>> {
  const orchestrator = new ScannerOrchestrator(progressCallback, "continue");

  const operations = [
    {
      name: "wavAnalysis",
      scanner: async (input: {
        files: string[];
        fileReader?: (filePath: string) => Promise<ArrayBuffer>;
      }) => {
        const results: WAVAnalysisOutput[] = [];
        const errors: string[] = [];

        for (const filePath of input.files) {
          const result = await scanWAVAnalysis({
            filePath,
            fileReader: input.fileReader,
          });

          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(`Failed to analyze ${filePath}: ${result.error}`);
          }
        }

        if (errors.length > 0 && results.length === 0) {
          return {
            success: false,
            error: `All WAV analysis failed: ${errors.join(", ")}`,
          };
        }

        return {
          success: true,
          data: results,
        };
      },
      input: { files: wavFiles, fileReader },
    },
  ];

  return orchestrator.executeChain(operations);
}

/**
 * Execute RTF artist scanning only
 *
 * @param rtfFiles Array of RTF filenames to analyze
 * @param progressCallback Optional progress tracking callback
 * @returns RTF artist scan results
 */
export async function executeRTFArtistScan(
  rtfFiles: string[],
  progressCallback?: ProgressCallback,
): Promise<OrchestrationResult<{ rtfArtist?: RTFArtistOutput }>> {
  const orchestrator = new ScannerOrchestrator(progressCallback, "stop");

  const operations = [
    {
      name: "rtfArtist",
      scanner: scanRTFArtist,
      input: { files: rtfFiles } as RTFArtistInput,
    },
  ];

  return orchestrator.executeChain(operations);
}
