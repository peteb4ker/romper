// Scanner system exports

// Core types and interfaces
export type {
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
} from "./types";

// Core orchestrator
export { ScannerOrchestrator } from "./orchestrator";

// Individual scanners
export { scanRTFArtist } from "./rtfArtistScanner";
export { scanVoiceInference } from "./voiceInferenceScanner";
export { scanWAVAnalysis } from "./wavAnalysisScanner";

// High-level orchestration functions
export {
  executeFullKitScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
} from "./orchestrationFunctions";
