// Scanner types and interfaces

export interface ChainResult {
  completedOperations: number;
  errors: Array<{ error: string; operation: string }>;
  results: Record<string, any>;
  success: boolean;
  totalOperations: number;
}

export type ErrorHandlingStrategy = "continue" | "stop";

// Full kit scan types
export interface FullKitScanInput {
  fileReader?: (filePath: string) => Promise<ArrayBuffer>;
  samples: Record<number, string[]>;
  wavFiles: string[];
}

export interface FullKitScanOutput {
  voiceInference?: VoiceInferenceOutput;
  wavAnalysis?: WAVAnalysisOutput[];
}

export type ProgressCallback = (
  completed: number,
  total: number,
  currentOperation: string,
) => void;

// RTF artist types
export interface RTFArtistInput {
  rtfFiles: string[];
}

export interface RTFArtistOutput {
  bankArtists: Record<string, string>;
}

export type ScannerFunction<TInput, TOutput> = (
  input: TInput,
) => Promise<ScanResult<TOutput>> | ScanResult<TOutput>;

export interface ScanOperation<TInput = any, TOutput = any> {
  input: TInput;
  name: string;
  scanner: ScannerFunction<TInput, TOutput>;
}

export interface ScanResult<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

// Voice inference types
export interface VoiceInferenceInput {
  samples: Record<number, string[]>;
}

export interface VoiceInferenceOutput {
  voiceNames: Record<number, string>;
}

// WAV analysis types
export interface WAVAnalysisInput {
  filePath: string;
  fileReader?: (filePath: string) => Promise<ArrayBuffer>;
  wavData?: ArrayBuffer;
}

export interface WAVAnalysisOutput {
  bitDepth: number;
  bitrate: number;
  channels: number;
  isStereo: boolean;
  isValid: boolean;
  sampleRate: number;
}
