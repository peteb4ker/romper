---
layout: default
title: Scanning System
---

# Romper Scanning System

Romper includes an automated scanning system that analyzes sample kits to extract metadata and voice information. This system helps organize and understand your sample libraries by automatically inferring voice types, analyzing audio properties, and extracting artist information.

## Overview

The scanning system is built around a composable architecture that allows different types of analysis to be combined and orchestrated together. The main components are:

- **Voice Inference Scanner** - Automatically determines voice types (kick, snare, hi-hat, etc.) from sample filenames
- **WAV Analysis Scanner** - Extracts technical audio properties (sample rate, bit depth, channels)
- **RTF Artist Scanner** - Extracts artist/creator information from RTF metadata files
- **Scanner Orchestrator** - Coordinates and manages scanning operations with progress tracking

## Scanner Types

### Voice Inference Scanner

Analyzes sample filenames to determine what type of drum voice they represent. The scanner uses intelligent keyword matching to identify:

- **Kick drums**: kick, kk, bd
- **Snares**: snare, sn, sd  
- **Hi-hats**: hihat, hat, hh, closed, open, ch, oh
- **Percussion**: perc, glass, clave, tom, rim, ride, crash
- **Effects**: fx, effect, laser
- **Bass**: bass, 808, sub

The scanner handles complex patterns like:
- Multi-word matches ("hh closed", "floor tom")
- Word boundaries (prevents "kick" matching "kicker")
- Case-insensitive matching
- Capitalization normalization ("hihat" → "HH", "kick" → "Kick")

### WAV Analysis Scanner

Extracts technical properties from WAV audio files:

- **Sample Rate**: 44.1kHz, 48kHz, 96kHz, etc.
- **Bit Depth**: 16-bit, 24-bit, 32-bit
- **Channels**: Mono or stereo detection
- **Bitrate**: Calculated from sample rate × bit depth × channels
- **Format Validation**: Ensures WAV files meet Rample requirements

### RTF Artist Scanner

Parses RTF (Rich Text Format) metadata files commonly included with sample packs:

- **Artist Information**: Extracts creator/producer names
- **Bank Mapping**: Maps artists to specific kit banks (A, B, C, D)
- **File Format Support**: Handles standard RTF formatting
- **Naming Conventions**: Follows common sample pack file naming patterns

## Scanner Orchestrator

The `ScannerOrchestrator` class provides a unified interface for running scanning operations:

### Features

- **Progress Tracking**: Real-time progress callbacks for UI updates
- **Error Handling**: Configurable error strategies (stop on error vs. continue)
- **Composable Operations**: Chain multiple scanners together
- **Async Support**: Non-blocking operations for responsive UI
- **Result Aggregation**: Combines results from multiple scanners

### Usage Examples

```typescript
// Individual scanner operations
const voiceResult = await executeVoiceInferenceScan(samples);
const wavResult = await executeWAVAnalysisScan(wavFiles);
const rtfResult = await executeRTFArtistScan(rtfFiles);

// Full kit scanning (all operations)
const fullResult = await executeFullKitScan(kitPath, sampleFiles);

// Custom orchestration
const orchestrator = new ScannerOrchestrator(progressCallback, "continue");
const result = await orchestrator.executeChain([
  { name: "voices", scanner: scanVoiceInference, input: samples },
  { name: "wav", scanner: scanWAVAnalysis, input: files }
]);
```

## Database Integration

Scanning results are automatically stored in the Romper database:

### Voice Information Storage
- Voice aliases are updated in the `voices` table
- Links to kits using `kit_name` foreign key
- Supports voice numbers 1-4 for each kit

### Sample Metadata Storage
- WAV properties stored in `samples` table
- Includes bitrate, sample rate, and channel information
- Maintains relationship to parent kit and voice

### Artist Information
- Artist metadata can be stored in kit records
- Supports bulk updates from RTF scanning results

## Error Handling

The scanning system includes robust error handling:

### Error Strategies
- **Stop on Error**: Halt scanning chain when any operation fails
- **Continue on Error**: Skip failed operations and continue with remaining scanners
- **Partial Results**: Return successful results even when some operations fail

### Error Reporting
- Detailed error messages with operation context
- Error aggregation across multiple scanning operations
- Progress tracking includes error counts and details

## Performance Considerations

### Optimization Features
- **Batch Processing**: Process multiple files efficiently
- **Memory Management**: Stream large files to avoid memory issues
- **Caching**: Cache analysis results to avoid re-scanning unchanged files
- **Background Processing**: Non-blocking operations for UI responsiveness

### File System Integration
- **Path Validation**: Verify file existence before scanning
- **Format Detection**: Quick format validation before detailed analysis
- **Directory Traversal**: Efficient recursive directory scanning

## API Reference

### Core Functions

#### `executeFullKitScan(kitPath: string, sampleFiles: string[])`
Performs complete scanning of a kit including all available scanner types.

#### `executeVoiceInferenceScan(samples: {[voice: number]: string[]})`
Analyzes sample filenames to infer voice types for each voice number.

#### `executeWAVAnalysisScan(wavFiles: string[])`
Extracts technical audio properties from WAV files.

#### `executeRTFArtistScan(rtfFiles: string[])`
Parses RTF files to extract artist and metadata information.

### Scanner Functions

#### `scanVoiceInference(input: VoiceInferenceInput)`
Core voice type inference logic using filename analysis.

#### `scanWAVAnalysis(input: WAVAnalysisInput)`  
Core WAV file analysis and property extraction.

#### `scanRTFArtist(input: RTFArtistInput)`
Core RTF parsing and artist information extraction.

### Classes

#### `ScannerOrchestrator`
Main orchestration class for chaining and managing scanning operations.

```typescript
constructor(
  progressCallback?: ProgressCallback,
  errorStrategy: ErrorStrategy = "continue"
)
```

## Integration with Romper

### Local Store Wizard
- Automatic scanning during initial kit discovery
- Progress reporting during wizard setup
- Error handling for corrupted or invalid files

### Manual Scanning
- User-initiated rescanning of specific kits
- Selective scanning of individual scanner types
- Real-time progress feedback in UI

### Database Operations
- Automatic database updates with scanning results
- Transaction support for atomic updates
- Rollback support for failed operations

---

_Last updated: 2025-06-23_

<!-- Documentation reflects scannerOrchestrator.ts implementation as of 2025-06-23 -->
