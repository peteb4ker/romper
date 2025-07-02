// Scanner types and interfaces

export interface ScanResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export type ScannerFunction<TInput, TOutput> = (
  input: TInput,
) => ScanResult<TOutput> | Promise<ScanResult<TOutput>>;

export type ProgressCallback = (
  completed: number,
  total: number,
  currentOperation: string,
) => void;

export type ErrorHandlingStrategy = "continue" | "stop";

export interface ScanOperation<TInput = any, TOutput = any> {
  name: string;
  scanner: ScannerFunction<TInput, TOutput>;
  input: TInput;
}

export interface ChainResult {
  success: boolean;
  results: Record<string, any>;
  errors: Array<{ operation: string; error: string }>;
  completedOperations: number;
  totalOperations: number;
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
  sampleRate: number;
  bitDepth: number;
  channels: number;
  bitrate: number;
  isStereo: boolean;
  isValid: boolean;
}

// RTF artist types
export interface RTFArtistInput {
  rtfFiles: string[];
}

export interface RTFArtistOutput {
  bankArtists: Record<string, string>;
}

// Full kit scan types
export interface FullKitScanInput {
  samples: Record<number, string[]>;
  wavFiles: string[];
  rtfFiles: string[];
  fileReader?: (filePath: string) => Promise<ArrayBuffer>;
}

export interface FullKitScanOutput {
  voiceInference?: VoiceInferenceOutput;
  wavAnalysis?: WAVAnalysisOutput[];
  rtfArtist?: RTFArtistOutput;
}
