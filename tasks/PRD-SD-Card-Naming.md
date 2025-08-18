# PRD: SD Card Sync Naming Convention Compliance

## Overview

Implement proper Squarp Rample naming conventions when syncing samples to SD card. This is a **WRITE operation** that transforms sample filenames during sync to match Rample hardware requirements, ensuring compatibility with the device.

## Background

The Squarp Rample hardware sampler has specific naming conventions for SD card content that must be followed for proper operation. Currently, Romper's sync system doesn't follow these conventions, potentially causing issues with sample recognition on the device.

## Requirements

### Squarp Rample SD Card Structure

**Kit Organization**:
- Each kit = one folder named `{BankLetter}{KitNumber}` (e.g., A0, B1, Z99)
- All kit folders must be in SD card root directory
- Bank letters: A-Z (26 banks)
- Kit numbers: 0-99 (100 kits per bank)
- Maximum: 2,600 total kits

**Sample File Naming**:
- First character MUST be voice number (1-4)
- Voice assignment determines which hardware voice triggers the sample
- Additional descriptive text allowed after voice number
- Examples: `1kick.wav`, `2snare.wav`, `3hihat.wav`, `4crash.wav`
- Multi-layer samples: `1sample1.wav`, `1sample2.wav` (up to 12 per voice)

**Technical Constraints**:
- File format: .wav (mono or stereo)
- Sample rate: 44100 Hz (16-bit or 8-bit)
- Minimum length: 50ms
- At least one voice 1 sample required per kit

## Current State Analysis

### Database Schema Alignment
- `kits.name` field contains proper Rample kit names (A0, B1, etc.) ✅
- `samples.voice_number` field maps to Rample voices (1-4) ✅
- `samples.source_path` stores original file location for reference ✅
- `samples.filename` stores original filename (will be transformed) ⚠️

### Current Sync Implementation Issues
- `getDestinationPath()` creates voice-based subdirectories: `/{kitName}/{voice_number}/{filename}`
- Should create flat structure: `/{kitName}/{voice_prefix}{filename}`
- Sample filenames not prefixed with voice numbers
- Path structure incompatible with Rample requirements

## Solution Design

### 1. Path Generation Transformation

**Current**: `/sync_output/{kitName}/{voice_number}/{filename}`
**Target**: `/{sdCardPath}/{kitName}/{voice_number}{generated_name}.wav`

### 2. Sample Filename Generation Strategy

Since original filename preservation is not critical (stored in DB), use simple, Rample-compliant naming:

**Option A - Descriptive Naming** (if slot metadata available):
- Voice 1: `1kick.wav`, `1bass.wav`, `1sample.wav`
- Voice 2: `2snare.wav`, `2lead.wav`, `2sample.wav`

**Option B - Slot-Based Naming** (simple and reliable):
- Voice 1, Slot 1: `1sample1.wav`
- Voice 1, Slot 2: `1sample2.wav`
- Voice 2, Slot 1: `2sample1.wav`

**Recommended**: Option B for consistency and simplicity.

### 3. Multi-Layer Sample Handling

For samples in the same voice (multi-layering):
- Use slot numbers to differentiate: `{voice}{slot}.wav`
- Voice 1, multiple slots: `1sample1.wav`, `1sample2.wav`, `1sample3.wav`
- Respect Rample's 12 samples per voice limit

## Implementation Plan

### Phase 1: Core Transformation Logic

1. **Create `RampleNamingService`**:
   - Generate Rample-compliant filenames from voice/slot data
   - Handle collision detection and resolution
   - Validate against Rample constraints

2. **Update `getDestinationPath()` in `SyncPlannerService`**:
   - Remove voice subdirectory structure
   - Use kit name directly as folder name
   - Apply filename transformation

### Phase 2: Integration and Testing

3. **Update sync workflow**:
   - Integrate naming service into existing sync pipeline
   - Maintain compatibility with existing sync operations
   - Preserve database references to original files

4. **Comprehensive testing**:
   - Unit tests for naming transformation logic
   - Integration tests for full sync workflow
   - Validation against Rample manual requirements

## Technical Specifications

### RampleNamingService Interface

```typescript
interface RampleNamingService {
  generateSampleFilename(voiceNumber: number, slotNumber: number): string;
  generateKitPath(kitName: string, sdCardRoot: string): string;
  validateRampleCompliance(path: string): boolean;
}
```

### Expected Transformations

| Current Path | Target Path |
|--------------|-------------|
| `/sync_output/A0/1/kick.wav` | `/sdcard/A0/1sample1.wav` |
| `/sync_output/A0/2/snare.wav` | `/sdcard/A0/2sample1.wav` |
| `/sync_output/B5/1/bass1.wav` | `/sdcard/B5/1sample1.wav` |
| `/sync_output/B5/1/bass2.wav` | `/sdcard/B5/1sample2.wav` |

## Success Criteria

1. **Compliance**: All generated paths follow Rample naming convention exactly
2. **Compatibility**: Existing sync workflow continues to work without breaking changes
3. **Validation**: New naming system passes all existing sync tests
4. **Documentation**: Clear documentation of transformation logic and Rample requirements

## Risks and Mitigation

**Risk**: Filename collisions in generated names
**Mitigation**: Use slot-based numbering system to ensure uniqueness

**Risk**: Breaking existing sync functionality
**Mitigation**: Comprehensive integration testing and backwards compatibility validation

**Risk**: Performance impact of filename generation
**Mitigation**: Simple naming algorithm with minimal computational overhead

## Out of Scope

- Changes to database schema (current schema sufficient)
- Modification of sample import/reference system
- User interface changes for naming preferences
- Support for custom naming patterns