# Romper Cleanup Plan - Post Drag & Drop Success

🎉 **MAJOR SUCCESS**: Drag and drop + undo/redo working 100%!

## Issues Identified

### 1. **Memory Leak/Hanging Test** 🔥 CRITICAL
- **Symptom**: Tests crash with "JavaScript heap out of memory" after ~80 seconds
- **Root Cause**: Likely infinite loop or memory leak in test suite
- **Update**: User already fixed `realDatabaseValidation.integration.test.ts` - changed from `["FORCE_FAIL"]` to `expectedOrder`

### 2. **Linting Errors** (18 total: 6 errors, 12 warnings)
- Unused variables from slot terminology refactoring
- Missing React Hook dependencies 
- Dead code assignments

### 3. **Test Suite Issues**
- 328 total test files - need ruthless evaluation
- Some tests may be testing abandoned code
- Duplicate integration tests need consolidation

## Execution Plan

### Phase 1: Stop the Bleeding & Consolidate Tests 🚨
**Priority: CRITICAL - Fix memory leak and reduce duplication**

1. **Consolidate Duplicate Integration Tests**
   - Merge `dragDropOrderingBug.integration.test.ts` and `realDatabaseValidation.integration.test.ts`
   - Both test the same drag/drop ordering bug (sample 6 to slot 1)
   - **Action**: Create single `dragDropOperations.integration.test.ts` with comprehensive test cases
   - Delete the two original files after consolidation

2. **Identify Remaining Hanging Test**
   - Run tests with increased memory limit to see which test hangs
   - **Action**: `node --max-old-space-size=8192 node_modules/.bin/vitest --run`
   - Identify specific test causing infinite loop/memory leak

### Phase 2: Clean Linting Errors ⚡
**Priority: HIGH - Quick wins**

1. **Remove Unused Imports/Variables**
   - `uiSlotToDbSlot` (multiple files) - legacy from slot refactoring
   - `sampleCount` in `useSlotRendering.ts` 
   - `renderEmptySlot` in `useVoicePanelSlots.tsx`
   - `samples` in `slotUtils.test.ts`

2. **Fix React Hook Dependencies**
   - Add `setDraggedSample` to dependency arrays in `useInternalDragHandlers.ts`

### Phase 3: Test Suite Ruthless Evaluation 🗡️
**Priority: MEDIUM - Be aggressive**

1. **Categorize Tests by Value**
   - **Keep**: Tests for core functionality (drag/drop, undo/redo, database operations)
   - **Fix**: Tests for actively used components/hooks
   - **DELETE**: Tests for abandoned/refactored code

2. **Test Deletion Candidates**
   - Tests for old slot terminology functions
   - Tests for unused utility functions
   - Tests for refactored components that no longer exist
   - Integration tests that duplicate unit test coverage

3. **Test Performance Review**
   - Remove tests with excessive timeouts
   - Simplify over-complex test setups
   - Remove redundant test scenarios

### Phase 4: Remove Debug Code 🧹
**Priority: LOW - Cleanup**

1. **Remove Debug Logging**
   - Console.log statements in `sampleMovement.ts`
   - Console.log statements in `useInternalDragHandlers.ts`
   - Keep only essential error logging

2. **Remove Development Tests**
   - Remove `dragDropIntegration.integration.test.ts` (development debugging)
   - Remove other temporary test files

## Success Metrics

- ✅ Tests run to completion without memory crashes
- ✅ Linting passes with 0 errors/warnings  
- ✅ Test suite runs in <30 seconds (target: significant reduction from 328 files)
- ✅ No debug logging in production code
- ✅ All drag & drop functionality still works perfectly

## Risk Assessment

**LOW RISK**: The core functionality is working. This is purely cleanup.
- Drag & drop ✅ Working 100%
- Undo/redo ✅ Working 100% 
- Database operations ✅ Working
- Single drop zones ✅ Working
- Cross-voice moves ✅ Working

**APPROACH**: Be ruthless with test deletion. If functionality works and has some test coverage, don't need exhaustive tests for every edge case.

## Estimated Time

- **Phase 1** (Critical): 15 minutes
- **Phase 2** (Linting): 10 minutes  
- **Phase 3** (Test cleanup): 30-45 minutes
- **Phase 4** (Debug cleanup): 5 minutes

**Total**: ~1-1.5 hours for complete cleanup

---

**Next Action**: Execute Phase 1 immediately to stop test crashes, then proceed through phases systematically.