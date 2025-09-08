# Stereo Sample Handling PRD

## Introduction

Stereo sample playback on the Rample can be implemented by linking two mono channels and using each channel's mono output as one half of a stereo pair.  Left is the first voice in the pair, Right is the second voice in the pair.

## Problem Statement

The current stereo sample handling implementation in Romper misinterprets how the Squarp Rample hardware handles stereo samples. This leads to incorrect behavior that doesn't match the actual device specifications.  This PRD addresses this, laying out a clear spec for stereo handling within Romper.

## Current (Incorrect) Implementation Issues

### 1. Voice Channel Misunderstanding
- **Current**: Treats stereo samples as consuming two adjacent individual voices (N and N+1)
- **Actual Rample Behavior**: A stereo sample consumes 2 mono voices, and the voice then becomes stereo-only

### 2. Mixed Sample Types in Voice
- **Current**: Allows mixing mono and stereo samples within the same voice
- **Actual Rample Behavior**: "All layers must be of the same type (mono OR stereo) in a voice"

### 3. Database Schema Problems
- **Current**: `is_stereo` flag on individual samples
- **Missing**: Voice-level stereo mode tracking

### 4. Implementation Gaps
- No enforcement of voice-level stereo consistency
- Incorrect SD card file generation for stereo voices
- UI doesn't reflect voice-level stereo status

## Correct Rample Stereo Behavior (From Manual Research)

### Key Specifications
1. **"A stereo sample will fill 2 mono voices"** - Each stereo sample consumes two of the 4 available voices
2. **"All layers must be of the same type (mono OR stereo) in a voice"** - Cannot mix mono and stereo in same voice
3. **Voice linking**: If voice 1 has stereo samples, all samples on voice 1 must be stereo AND voice 2 becomes linked
4. **Channel allocation**: Stereo samples are sequential - you cannot manually assign which voices a stereo sample uses

### Hardware Implications
- **4 voices total**: Using stereo reduces effective voice count
- **Voice 1 stereo → Voice 2 linked**: Voice 2 becomes unavailable for independent use
- **Voice 2 stereo → Voice 3 linked**: Voice 3 becomes unavailable for independent use
- **Voice 3 stereo → Voice 4 linked**: Voice 4 becomes unavailable for independent use
- **Voice 4 stereo → Impossible**: No voice 5 exists, must force mono conversion

## Required Corrections

### 1. Database Schema Updates

#### New Voice-Level Stereo Tracking
```sql
-- Add to voices table
ALTER TABLE voices ADD COLUMN stereo_mode BOOLEAN NOT NULL DEFAULT 0;

-- Voice-level constraint: if stereo_mode=1, all samples in voice must be stereo
-- If stereo_mode=0, all samples must be mono
```

This must be implemented as a drizzle migration.

#### Sample Constraints
```sql
-- Constraint: samples in stereo voice must all be stereo
-- Constraint: samples in mono voice must all be mono
-- Constraint: stereo voices link to next voice (1→2, 3→4)
```

### 2. Core Logic Changes

#### Voice Assignment Rules
1. **Mono Sample Assignment**: Can go to any voice in mono mode
2. **Stereo Sample Assignment**:
   - Can only go to voice 1, 2 or 3 (voices that have a +1 available)
   - Target voice AND next voice (+1) must both be empty OR target voice is already stereo
   - All existing samples in target voice must already be stereo
   - Sets `voices.stereo_mode = 1` for target voice
   - Next voice (+1) becomes **linked** (unavailable for independent assignment)

#### Voice Mode Transitions
- **Mono → Stereo**: Allowed if voice is empty OR all existing samples are already stereo
- **Stereo → Mono**: Requires removing all stereo samples first. Converting all stereo samples to mono is an option, with appropriate user warning.
- **Mixed**: Never allowed - validation must prevent

### 3. UI/UX Changes

#### Voice Panel Indicators
- Clear stereo/mono mode indicator per voice (Same for voice 1-3. Different for voice 4.)
- Show when voice is linked to previous voice.  Use the link / unlink iconography for this.
- Prevent drops to linked voices
- Voice-level stereo toggle (when appropriate)

#### Validation Messages
- "Voice X is in stereo mode - all samples must be stereo"
- "Voice X is linked to stereo voice Y"
- "Cannot assign stereo to voice 4 - stereo only supported by voices 1-3"

### 4. Drag & Drop Logic Updates

#### Pre-Drop Validation
```typescript
interface VoiceValidation {
  canAccept: boolean;
  reason?: string;
  requiresConversion?: 'mono' | 'stereo';
  voiceMode: 'mono' | 'stereo' | 'linked';
}

// Check voice mode compatibility BEFORE allowing drop
// Enforce voice-level consistency
// Handle linked voice prevention
```

### 5. SD Card Generation Fixes

#### File Naming & Structure
- Stereo voices generate files for BOTH channels
- Linked voices generate NO independent files
- Proper channel allocation (voice 1 stereo uses channels 1+2)
- File naming follows Rample spec for stereo pairs

#### Sync Operation Changes
- Voice-level stereo mode drives file generation
- Stereo conversion happens at voice level, not sample level
- Linked voice handling in sync operations

## Implementation Phases

### Phase 1: Database Schema & Migration
- Add `stereo_mode` to voices table
- Create migration to analyze existing data and set voice modes
- Add voice-level constraints

### Phase 2: Core Logic Refactor
- Update `useStereoHandling` to work at voice level
- Implement voice mode transition logic
- Fix sample assignment validation

### Phase 3: UI Updates
- Voice-level stereo indicators
- Linked voice visual state - both left and right.
- Updated validation messages
- Stereo mode controls

### Phase 4: SD Card Generation
- Voice-level file generation
- Proper stereo channel allocation
- Linked voice handling

### Phase 5: Testing & Validation
- Test voice mode transitions
- Validate against actual Rample device behavior
- Edge case handling (voice 4, conflicts, etc.)

## Success Criteria

1. **Voice-level consistency**: All samples in a voice are same type (mono/stereo)
2. **Proper linking**: Stereo voices correctly link to next voice
3. **UI accuracy**: Interface clearly shows voice modes and linked states
4. **Hardware compatibility**: Generated SD card files work correctly on actual Rample device
5. **Edge case handling**: Voice 4 stereo attempts are handled gracefully

## Questions for Review

1. Should we provide a migration path for existing kits with mixed mono/stereo in same voice?
 - No
2. How should we handle voice mode transitions when user has existing samples?
 -  Provide a warning with the expectation they fix it.
3. Should voice-level stereo mode be user-controllable or automatically determined by sample types?
 - User controllable - stereo samples are only handled when channels are linked. Otherwise they are treated as mono (and a warning is given to the user: 'stereo sample added to mono track - will be converted to mono on sync')
4. What's the UX for showing linked voices in the interface?
 - The UX agent will determine this. Use linked and unlinked chain icons.  Potentially between the voices at the top.   Warnings and messages to be given via the centralized toast system.  once voices are linked, they should incicate as such as they have a border around both of them.  maybe they become one double-wide voice with 12 slots.  and the color should be subtly diffferent.  play on these concepts.

## Files Requiring Changes

### Database Layer
- `shared/db/schema.ts` - Add voice stereo_mode
- Migration files - Data migration script, ceeated by drizle.
- Database operations - Voice mode updates

### Core Logic
- `app/renderer/components/hooks/sample-management/useStereoHandling.ts` - Complete rewrite
- `electron/main/services/syncFileOperations.ts` - Voice-level sync
- Sample validation services - Voice mode validation

### UI Components
- `app/renderer/components/KitVoicePanel.tsx` - Voice mode indicators
- `app/renderer/components/KitVoicePanels.tsx` - Linked voice handling
- Drag/drop handlers - Voice mode validation

### Testing
- All stereo-related tests need updates
- New voice-level stereo tests
- Integration tests for voice linking

This PRD provides the foundation for correcting the stereo handling implementation to match actual Rample hardware behavior.