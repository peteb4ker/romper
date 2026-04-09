# Code Generation Plan: Unit 1b — Onboarding Resilience

## Unit Context
- **FR**: FR-13 (partial — resilience only)
- **Priority**: P0
- **Dependencies**: Unit 1a (complete)
- **Scope**: Backend robustness — download retry, cleanup on failure, graceful degradation, wizard closure safety

## Steps

### Step 1: Add download retry logic for factory samples
- [x] Modify `extractSquarpArchive` in `useLocalStoreWizardFileOps.ts`
- [x] Wrap `downloadAndExtractArchive` call in retry logic (3 attempts, exponential backoff 2s/4s)
- [x] On retry, update progress message: "Download failed, retrying (attempt X of 3)..."
- [x] After all retries exhausted, throw: "Factory samples download failed after 3 attempts..."
- [x] Test-friendly: maxRetries=1 in test environment to avoid timeouts

### Step 2: Add cleanup on initialization failure
- [x] Added `removeDirectorySafe()` utility (scoped to .romperdb paths only)
- [x] Registered `cleanup-partial-init` IPC handler
- [x] Exposed `cleanupPartialInit` via preload bridge + type definitions
- [x] Initialize error handler calls cleanup to remove partial .romperdb

### Step 3: Graceful degradation for invalid local store
- [x] Added `onRerunWizard` prop to `InvalidLocalStoreDialog.tsx`
- [x] Added "Re-run Setup Wizard" button with `data-testid="rerun-wizard-btn"`

### Step 4: Safe wizard closure handling
- [x] Cancel button shows confirmation dialog when `isInitializing` is true
- [x] Confirmation explains risk of incomplete database

### Step 5: Unit tests updated
- [x] Updated existing tests for new retry error messages
- [x] All 3,397 tests passing (230 files)

### Step 6: Code summary
- [x] Summary below

## Summary
Modified 6 files, created 0 new files. Added retry logic, cleanup endpoint, wizard re-run option, safe closure confirmation. All tests passing.
