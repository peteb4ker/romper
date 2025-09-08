<!-- 
title: Stereo Sample Handling Implementation Tasks
priority: critical
status: active  
updated: 2025-09-07
context_size: large
target_release: immediate
category: bug-fix
-->

# Stereo Sample Handling Implementation Tasks

**Critical bug fix** - Current implementation fundamentally misinterprets Rample stereo behavior.

## Overview
Fix stereo sample handling to match actual Squarp Rample hardware behavior where stereo voices must link adjacent voices and maintain voice-level consistency.

---

## STEREO.1: Database Schema Updates
**Priority:** Critical | **Status:** Not Started | **Target:** Phase 1

### STEREO.1.1: Add Voice-Level Stereo Mode Tracking
- [x] Add `stereo_mode` BOOLEAN column to voices table
- [x] Create Drizzle migration script
- [x] Add voice-level constraints for sample consistency
- [ ] Test migration with existing data (skipped per user)

**Files:**
- `shared/db/schema.ts`
- `electron/main/db/migrations/` (new migration file)

**Success Criteria:**
- Migration runs successfully on existing databases
- Voice stereo mode properly tracked at voice level
- Database constraints prevent mixed mono/stereo in same voice

### STEREO.1.2: Update Database Operations
- [x] Modify voice creation to include stereo_mode
- [x] Update sample insertion to validate voice compatibility  
- [x] Add voice linking validation in database layer
- [x] Create voice mode transition operations

**Files:**
- `electron/main/db/operations/`
- Voice and sample CRUD operations

**Success Criteria:**
- Voice operations respect stereo mode constraints
- Database prevents invalid voice/sample combinations
- Voice linking properly enforced at data layer

---

## STEREO.2: Core Logic Refactor
**Priority:** Critical | **Status:** Not Started | **Target:** Phase 2

### STEREO.2.1: Rewrite useStereoHandling Hook
- [x] Replace current sample-level logic with voice-level logic
- [x] Implement voice linking validation (1→2, 2→3, 3→4)
- [x] Add voice mode transitions (mono↔stereo)
- [x] Handle voice 4 stereo prevention (no voice 5 available)
- [x] Implement user-controllable voice linking

**Files:**
- `app/renderer/components/hooks/sample-management/useStereoHandling.ts`

**Success Criteria:**
- Voice linking works correctly (1→2, 2→3, 3→4)
- Voice 4 stereo attempts show warning and convert to mono
- User can manually link/unlink voice pairs
- All samples in stereo voice must be stereo

### STEREO.2.2: Update Sample Assignment Logic  
- [x] Modify drag/drop validation for voice-level consistency
- [x] Add pre-drop voice compatibility checking
- [x] Implement stereo sample warnings for mono voices
- [x] Update sample processing to respect voice modes

**Files:**
- `app/renderer/components/hooks/shared/useDragAndDrop.ts`
- `app/renderer/components/hooks/sample-management/useSampleProcessing.ts`

**Success Criteria:**
- Cannot drop stereo samples on unlinked voices without warning
- Voice mode compatibility enforced before sample assignment
- Clear warnings when stereo samples added to mono voices

---

## STEREO.3: UI/UX Updates
**Priority:** High | **Status:** Not Started | **Target:** Phase 3

### STEREO.3.1: Voice Linking Visual Indicators
- [x] Add link/unlink chain icons between voice pairs
- [x] Show linked voice pairs with unified border/styling
- [x] Display linked voices as double-wide panels
- [x] Add subtle color differentiation for linked voices
- [x] Implement voice pair visual grouping

**Files:**
- `app/renderer/components/KitVoicePanel.tsx`
- `app/renderer/components/KitVoicePanels.tsx`

**Success Criteria:**
- Clear visual indication of linked voice pairs
- Linked voices appear as unified stereo unit
- User can easily identify voice relationships
- Visual design is intuitive and non-intrusive

### STEREO.3.2: Voice Linking Controls
- [x] Add link/unlink toggle controls between voices
- [x] Implement voice linking validation before allowing
- [x] Show linking restrictions (voice 4 cannot link)
- [ ] Add keyboard shortcuts for voice linking (deferred)
- [x] Prevent invalid linking attempts

**Files:**
- Voice panel components
- Keyboard shortcut handlers

**Success Criteria:**
- Users can manually link/unlink voice pairs
- Linking restrictions clearly communicated
- Smooth UX for voice mode transitions

### STEREO.3.3: Enhanced Validation Messages
- [x] "Voice X is in stereo mode - all samples must be stereo"
- [x] "Voice X is linked to stereo voice Y" 
- [x] "Stereo sample added to mono voice - will convert to mono on sync"
- [x] "Cannot assign stereo to voice 4 - stereo only supported by voices 1-3"
- [x] Implement centralized toast notification system integration

**Files:**
- Validation message components
- Toast system integration

**Success Criteria:**  
- Clear, actionable error/warning messages
- Consistent messaging across all stereo operations
- Users understand voice linking requirements

---

## STEREO.4: SD Card Generation Fixes  
**Priority:** High | **Status:** Not Started | **Target:** Phase 4

### STEREO.4.1: Voice-Level File Generation
- [x] Generate stereo files for linked voice pairs
- [x] Linked secondary voices generate no independent files
- [x] Proper channel allocation (voice 1→channels 1+2, voice 3→channels 3+4)
- [x] Implement Rample stereo file naming conventions
- [x] Handle stereo-to-mono conversion during sync

**Files:**
- `electron/main/services/syncFileOperations.ts`
- SD card file generation logic

**Success Criteria:**
- Stereo voices generate correct paired files
- File naming matches Rample hardware expectations
- Linked voices handled correctly in sync process
- Generated SD card works with actual Rample device

### STEREO.4.2: Sync Operation Updates
- [x] Voice-level stereo mode drives file generation strategy
- [x] Stereo conversion happens at voice level during sync
- [x] Linked voice handling in sync operations
- [x] Validate generated files match Rample requirements
- [ ] Add sync preview showing stereo file generation (deferred)

**Files:**
- Sync service components
- File generation utilities

**Success Criteria:**
- Sync process respects voice linking
- Generated files work correctly on Rample hardware
- User can preview stereo file generation before sync

---

## STEREO.5: Comprehensive Testing
**Priority:** High | **Status:** Not Started | **Target:** Phase 5

### STEREO.5.1: Unit Tests for Voice Linking
- [x] Test voice linking validation logic
- [x] Test voice mode transitions (mono↔stereo)
- [x] Test sample assignment validation 
- [x] Test voice 4 stereo prevention
- [x] Test database constraint enforcement

**Files:**
- `__tests__/` directories for relevant components
- New stereo-specific test files

**Success Criteria:**
- 100% test coverage for voice linking logic
- All edge cases properly tested
- Tests validate Rample hardware compliance

### STEREO.5.2: Integration Tests
- [x] Test complete stereo workflow (sample to SD card)
- [x] Test voice linking UI interactions
- [x] Test sync process with linked voices
- [ ] Test migration of existing mixed-mode data (skipped per user)
- [ ] Test actual Rample device compatibility (skipped per user)

**Files:**
- Integration test suites
- E2E test scenarios

**Success Criteria:**
- End-to-end stereo workflows function correctly
- Generated SD cards work on actual Rample hardware
- No regressions in existing mono functionality

### STEREO.5.3: Migration Testing
- [ ] Test migration of existing kits with mixed mono/stereo (skipped per user)
- [ ] Validate data integrity after migration (skipped per user)
- [ ] Test rollback scenarios if migration fails (skipped per user)
- [ ] Performance testing with large databases (skipped per user)
- [ ] Backup/restore testing for migration safety (skipped per user)

**Files:**
- Migration test scripts
- Database testing utilities

**Success Criteria:**
- Existing user data migrates safely
- No data loss during voice mode classification
- Migration process is reversible if needed

---

## Implementation Order

1. **STEREO.1.1** → Database schema foundation
2. **STEREO.1.2** → Database operations update  
3. **STEREO.2.1** → Core voice linking logic
4. **STEREO.2.2** → Sample assignment updates
5. **STEREO.3.1** → Visual indicators for linking
6. **STEREO.3.2** → Voice linking controls
7. **STEREO.4.1** → SD card generation fixes
8. **STEREO.3.3** → Enhanced validation messages
9. **STEREO.4.2** → Sync operation updates
10. **STEREO.5.1** → Unit testing
11. **STEREO.5.2** → Integration testing  
12. **STEREO.5.3** → Migration testing

## Success Metrics

- [x] **Voice-level consistency**: All samples in a voice are same type (mono/stereo)
- [x] **Proper linking**: Stereo voices correctly link to next voice  
- [x] **UI accuracy**: Interface clearly shows voice modes and linked states
- [ ] **Hardware compatibility**: Generated SD card files work correctly on actual Rample device (skipped per user)
- [x] **Edge case handling**: Voice 4 stereo attempts are handled gracefully
- [x] **No regressions**: Existing mono functionality remains intact
- [ ] **Data safety**: User data is preserved through migration process (skipped per user)

## Migration Strategy

As answered in PRD review:
1. **No automatic migration** of mixed mono/stereo voices
2. **User warning system** for voice mode transitions with existing samples
3. **User-controllable** voice linking with clear visual indicators
4. **Toast notification system** for all warnings and status messages

This implementation will bring stereo handling into compliance with actual Rample hardware behavior.