---
layout: default
title: Scanning System API Reference
---

# Scanning System API Reference

This document provides detailed API reference for Romper's scanning system components.

## Core Interfaces

### ScannerResult<T>
Base interface for all scanner results.

```typescript
interface ScannerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### OrchestrationResult<T>
Result interface for orchestrated scanning operations.

```typescript
interface OrchestrationResult<T> {
  success: boolean;
  results: T;
  errors: Array<{ operation: string; error: string }>;
  completedOperations: number;
  totalOperations: number;
}
```

## Voice Inference Scanner

### Interfaces

```typescript
interface VoiceInferenceInput {
  samples: { [voice: number]: string[] };
}

interface VoiceInferenceOutput {
  voiceNames: { [voice: number]: string | null };
}
```

### Functions

#### `scanVoiceInference(input: VoiceInferenceInput): ScannerResult<VoiceInferenceOutput>`
Analyzes sample filenames to infer voice types.

**Parameters:**
- `input.samples` - Object mapping voice numbers (1-4) to arrays of sample file paths

**Returns:**
- Scanner result with voice names mapped to voice numbers
- Voice names are capitalized (e.g., "Kick", "Snare", "HH")
- Unused voices return `null`

**Example:**
```typescript
const result = scanVoiceInference({
  samples: {
    1: ["/path/to/kick.wav"],
    2: ["/path/to/snare.wav"]
  }
});
// result.data.voiceNames = { 1: "Kick", 2: "Snare", 3: null, 4: null }
```

#### `executeVoiceInferenceScan(samples: {[voice: number]: string[]}, progressCallback?: ProgressCallback): Promise<OrchestrationResult<{voiceInference?: VoiceInferenceOutput}>>`
Orchestrated voice inference scanning with progress tracking.

## WAV Analysis Scanner

### Interfaces

```typescript
interface WAVAnalysisInput {
  filePath: string;
  fileReader?: (filePath: string) => Promise<ArrayBuffer>;
}

interface WAVAnalysisOutput {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  bitrate: number;
  isStereo: boolean;
  isValid: boolean;
}
```

### Functions

#### `scanWAVAnalysis(input: WAVAnalysisInput): Promise<ScannerResult<WAVAnalysisOutput>>`
Analyzes WAV file properties.

**Parameters:**
- `input.filePath` - Path to WAV file to analyze
- `input.fileReader` - Optional custom file reader function (for testing)

**Returns:**
- Scanner result with technical audio properties
- Includes sample rate, bit depth, channel count, bitrate
- `isValid` indicates if file meets Rample requirements

#### `executeWAVAnalysisScan(wavFiles: string[], fileReader?: (filePath: string) => Promise<ArrayBuffer>, progressCallback?: ProgressCallback): Promise<OrchestrationResult<{wavAnalysis?: WAVAnalysisOutput[]}>>`
Orchestrated WAV analysis for multiple files.

## RTF Artist Scanner

### Interfaces

```typescript
interface RTFArtistInput {
  files: string[];
}

interface RTFArtistOutput {
  bankArtists: { [bank: string]: string };
}
```

### Functions

#### `scanRTFArtist(input: RTFArtistInput): ScannerResult<RTFArtistOutput>`
Parses RTF files to extract artist information.

**Parameters:**
- `input.files` - Array of RTF filenames to parse

**Returns:**
- Scanner result with bank-to-artist mappings
- Bank keys are single letters (A, B, C, D)
- Empty object if no valid RTF files found

#### `executeRTFArtistScan(rtfFiles: string[], progressCallback?: ProgressCallback): Promise<OrchestrationResult<{rtfArtist?: RTFArtistOutput}>>`
Orchestrated RTF artist scanning.

## Scanner Orchestrator

### Class: ScannerOrchestrator

#### Constructor
```typescript
constructor(
  progressCallback?: ProgressCallback,
  errorStrategy: ErrorStrategy = "continue"
)
```

**Parameters:**
- `progressCallback` - Optional function to receive progress updates
- `errorStrategy` - How to handle errors: "stop" or "continue"

#### Methods

##### `executeChain<T>(operations: ScannerOperation[]): Promise<OrchestrationResult<T>>`
Executes a chain of scanning operations.

**Parameters:**
- `operations` - Array of scanner operations to execute

**Returns:**
- Orchestration result with combined results from all operations

### High-Level Functions

#### `executeFullKitScan(kitPath: string, sampleFiles: string[], progressCallback?: ProgressCallback): Promise<OrchestrationResult<FullKitScanResult>>`
Performs complete scanning of a kit including all scanner types.

**Parameters:**
- `kitPath` - Path to the kit directory
- `sampleFiles` - Array of sample file paths in the kit
- `progressCallback` - Optional progress tracking callback

**Returns:**
- Orchestration result with combined results from:
  - Voice inference scanning
  - WAV analysis scanning  
  - RTF artist scanning

## Database Integration

### DatabaseScanResult
```typescript
interface DatabaseScanResult {
  success: boolean;
  scannedKits: number;
  scannedVoices: number;
  scannedWavFiles: number;
  scannedRtfFiles: number;
  errors: Array<{ operation: string; error: string }>;
}
```

### Functions

#### `scanKitToDatabase(dbDir: string, kitData: KitScanData): Promise<DatabaseScanResult>`
Scans a kit and stores results in the database.

#### `scanVoiceNamesToDatabase(dbDir: string, kitName: string, samples: {[voice: number]: string[]}): Promise<DatabaseScanResult>`
Scans voice names and updates database voice aliases.

#### `setDatabaseOperations(dbOps: any): void`
Sets custom database operations for testing or alternative implementations.

## Type Definitions

### Utility Types

```typescript
type ProgressCallback = (completed: number, total: number, operation: string) => void;
type ErrorStrategy = "stop" | "continue";
type ScannerFunction<TInput, TOutput> = (input: TInput) => Promise<ScannerResult<TOutput>> | ScannerResult<TOutput>;
```

### KitScanData
```typescript
interface KitScanData {
  kitId: number;
  kitName: string;
  kitPath: string;
  samples: { [voice: number]: string[] };
  wavFiles: string[];
  rtfFiles: string[];
}
```

## Error Handling

All scanning functions include comprehensive error handling:

- **Invalid file paths**: Functions validate file existence before processing
- **Corrupted files**: WAV analysis detects and reports invalid audio files
- **Missing data**: Scanners gracefully handle missing or empty inputs
- **Database errors**: Database operations include transaction support and rollback
- **Progress tracking**: Errors are reported through progress callbacks with operation context

## Usage Examples

### Basic Voice Inference
```typescript
import { scanVoiceInference } from './scannerOrchestrator';

const samples = {
  1: ['kick_01.wav', 'kick_02.wav'],
  2: ['snare_01.wav'],
  3: ['hihat_closed.wav', 'hihat_open.wav']
};

const result = scanVoiceInference({ samples });
if (result.success) {
  console.log('Voice names:', result.data.voiceNames);
}
```

### Full Kit Scanning with Progress
```typescript
import { executeFullKitScan } from './scannerOrchestrator';

const progressCallback = (completed, total, operation) => {
  console.log(`${operation}: ${completed}/${total}`);
};

const result = await executeFullKitScan(
  '/path/to/kit',
  ['1kick.wav', '2snare.wav', '3hihat.wav'],
  progressCallback
);

if (result.success) {
  console.log('Voice inference:', result.results.voiceInference);
  console.log('WAV analysis:', result.results.wavAnalysis);
  console.log('RTF scanning:', result.results.rtfScanning);
}
```

### Database Integration
```typescript
import { scanKitToDatabase } from './databaseScanning';

const kitData = {
  kitId: 1,
  kitName: 'My Kit',
  kitPath: '/path/to/kit',
  samples: { 1: ['kick.wav'], 2: ['snare.wav'] },
  wavFiles: ['kick.wav', 'snare.wav'],
  rtfFiles: []
};

const result = await scanKitToDatabase('/path/to/db', kitData);
console.log(`Scanned ${result.scannedVoices} voices`);
```

---

_Last updated: 2025-06-23_
