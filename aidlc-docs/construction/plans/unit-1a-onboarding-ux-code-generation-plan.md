# Code Generation Plan: Unit 1a — Onboarding UX

## Unit Context
- **FR**: FR-13 (partial — UX improvements only)
- **Priority**: P0 (highest)
- **Scope**: User-facing improvements to wizard flows — better errors, pre-checks, progress, empty state guidance
- **Dependencies**: None
- **Workspace Root**: /Users/pete/workspace/romper/worktrees/aidlc-comprehensive-testing

## Steps

### Step 1: Add disk space and writability pre-checks to IPC layer
- [x] Add new IPC endpoint `checkDiskSpace(path: string)` in electron/main that returns `{ available: number, required: number, sufficient: boolean }`
- [x] Add new IPC endpoint `checkPathWritable(path: string)` in electron/main that returns `{ writable: boolean, error?: string }`
- [x] Expose both via preload bridge
- [x] Use Node.js `fs.statfs` (or `fs.access` for writability) — no new dependencies

### Step 2: Enhance SD card validation error messages
- [x] Modify `useLocalStoreWizardFileOps.ts` SD card validation (lines 37-48)
- [x] When no kit folders found, include: the path that was scanned, what folders were found (if any), and the expected naming format
- [x] Example: "No kit folders found in /Volumes/RAMPLE. Found: [Documents, Music]. Expected folders named like A0, B1, Drum01."

### Step 3: Add sample truncation user notification
- [x] Modify `useLocalStoreWizardFileOps.ts` sample limiting logic (lines 150-172)
- [x] Track truncated samples in a `truncationWarnings` array: `{ kitName, voiceNumber, total, kept, skipped }`
- [x] Surface warnings through the hook return value so UI can display them
- [x] After initialization completes, if warnings exist, display summary in `LocalStoreWizardUI.tsx`

### Step 4: Add disk space and writability checks to wizard target step
- [x] Modify `useLocalStoreWizard.ts` `initialize()` function (lines 142-197)
- [x] Before any file operations, call `checkPathWritable(targetPath)` — if not writable, set specific error: "Cannot write to [path]. Please choose a folder you have permission to write to."
- [x] Before copy/download operations, call `checkDiskSpace(targetPath)` with estimated size:
  - SD card: estimate from source directory size
  - Squarp: ~1GB (hardcoded estimate for extraction)
  - Blank: minimal (skip check)
- [x] If insufficient space, set specific error: "Not enough disk space. Need ~[X] MB but only [Y] MB available at [path]."

### Step 5: Enhance progress reporting with per-kit detail
- [x] Modify `useLocalStoreWizard.ts` progress reporting (lines 37-72)
- [x] Add `kitName` field to progress state: `{ phase, percent, file, kitName?, totalKits?, currentKit? }`
- [x] During kit scanning/copying, report: "Kit A0 (3 of 26)" with kit context
- [x] Modify `WizardProgressBar.tsx` to display kit context when available
- [x] Add `data-testid="wizard-progress-kit"` for the kit detail text

### Step 6: Add empty library next-steps guidance
- [x] Create new component `app/renderer/components/wizard/WizardPostInitGuidance.tsx` (combined blank folder guidance + truncation warnings)
- [x] Shows after wizard completes when source was "blank" or truncation warnings exist
- [x] Add `data-testid` attributes: `"wizard-post-init-guidance"`, `"truncation-warnings"`, `"blank-folder-guidance"`, `"post-init-continue-btn"`
- [x] Integrate into `LocalStoreWizardUI.tsx` via `showPostInitGuidance` state

### Step 7: Add data-testid attributes to wizard components lacking them
- [x] `WizardTargetStep.tsx`: add `data-testid="wizard-target-path-input"`, `"wizard-target-browse-btn"`, `"wizard-target-default-btn"`
- [x] `WizardSourceStep.tsx`: verified existing `data-testid="wizard-source-${opt.value}"` coverage
- [x] `WizardErrorMessage.tsx`: verified existing `data-testid="wizard-error"`

### Step 8: Generate unit tests for all new/modified code
- [x] Test disk space check IPC endpoint (checkDiskSpace, checkDiskSpaceSufficient)
- [x] Test writability check IPC endpoint (checkPathWritable)
- [x] Test enhanced SD card validation error messages (updated existing test)
- [x] Test WizardPostInitGuidance component (6 test cases: blank folder, warnings, dismiss, combined)
- [x] All 3,397 tests passing (230 files)

### Step 9: Generate code summary documentation
- [x] Create code summary

## Total Steps: 9
## Files Modified: ~8 existing files
## Files Created: ~2 new files (WizardBlankFolderComplete.tsx, IPC endpoints)
## Tests Created: ~9 test cases across new/modified functionality
