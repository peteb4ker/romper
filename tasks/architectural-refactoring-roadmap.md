# Architectural Refactoring Roadmap

> **Generated from architectural analysis results** - Health Score: 0/100 (POOR)
> **Analysis Date**: 2025-09-02
> **Priority**: Critical - Immediate action required

## Executive Summary

The architectural analysis identified **12 red flag files** exceeding 300 LOC that require immediate refactoring, plus **56 files** with excessive complexity. This roadmap provides a systematic approach to address these issues and improve the overall architectural health score.

## 🚨 Critical Priority (Phase 1) - Red Flag Files (300+ LOC)

### Task 1.1: Refactor syncService.ts (867 LOC) → Target: <300 LOC
**File**: `electron/main/services/syncService.ts`
**Current**: 867 LOC | **Target**: 4-5 files of ~200 LOC each
**Priority**: CRITICAL

**Refactoring Strategy**:
- [ ] Extract sync validation logic → `syncValidationService.ts` (~150 LOC)
- [ ] Extract file operations → `syncFileOperations.ts` (~200 LOC) 
- [ ] Extract progress tracking → `syncProgressManager.ts` (~100 LOC)
- [ ] Extract format conversion coordination → `syncFormatManager.ts` (~150 LOC)
- [ ] Keep core orchestration in main file (~200 LOC)

**Acceptance Criteria**:
- [ ] All existing tests pass
- [ ] Each extracted service has single responsibility
- [ ] Public API remains unchanged
- [ ] Error handling preserved across modules

---

### Task 1.2: Refactor sampleCrudService.ts (467 LOC) → Target: <300 LOC
**File**: `electron/main/services/crud/sampleCrudService.ts`
**Current**: 467 LOC | **Target**: 2-3 files of ~200 LOC each
**Priority**: CRITICAL

**Refactoring Strategy**:
- [ ] Extract sample validation → `sampleValidation.ts` (~100 LOC)
- [ ] Extract batch operations → `sampleBatchOperations.ts` (~200 LOC)
- [ ] Keep core CRUD in main file (~200 LOC)

---

### Task 1.3: Refactor crudOperations.ts (466 LOC) → Target: <300 LOC
**File**: `electron/main/db/operations/crudOperations.ts`
**Current**: 466 LOC | **Target**: 3 files of ~150 LOC each
**Priority**: CRITICAL

**Refactoring Strategy**:
- [ ] Extract kit operations → `kitCrudOperations.ts` (~150 LOC)
- [ ] Extract sample operations → `sampleCrudOperations.ts` (~150 LOC) 
- [ ] Extract voice operations → `voiceCrudOperations.ts` (~150 LOC)

---

### Task 1.4: Refactor SyncUpdateDialog.tsx (406 LOC) → Target: <300 LOC
**File**: `app/renderer/components/dialogs/SyncUpdateDialog.tsx`
**Current**: 406 LOC | **Target**: Multi-step wizard components
**Priority**: HIGH

**Refactoring Strategy**:
- [ ] Extract wizard step components → `SyncWizardStep1.tsx`, `SyncWizardStep2.tsx`, etc.
- [ ] Extract sync progress component → `SyncProgressDisplay.tsx` (~100 LOC)
- [ ] Extract validation display → `SyncValidationResults.tsx` (~100 LOC)
- [ ] Keep dialog container (~100 LOC)

---

### Task 1.5: Refactor KitGrid.tsx (338 LOC) → Target: <300 LOC
**File**: `app/renderer/components/KitGrid.tsx`
**Current**: 338 LOC | **Target**: Component + custom hooks
**Priority**: HIGH

**Refactoring Strategy**:
- [ ] Extract virtualization logic → `useKitGridVirtualization.ts` (~100 LOC)
- [ ] Extract keyboard navigation → `useKitGridKeyboard.ts` (~80 LOC)
- [ ] Keep grid rendering (~150 LOC)

---

## 🟡 High Priority (Phase 2) - Remaining Red Flags

### Task 2.1: useVoicePanelSlots.tsx (374 LOC) → Target: <200 LOC
- [ ] Extract slot management logic to custom hook
- [ ] Simplify component to pure rendering

### Task 2.2: PreferencesDialog.tsx (371 LOC) → Target: <250 LOC
- [ ] Extract preference sections into separate components
- [ ] Extract form validation logic to custom hook

### Task 2.3: databaseScanning.ts (342 LOC) → Target: <250 LOC
- [ ] Split scanning operations by domain (kits, samples, voices)
- [ ] Extract progress tracking utilities

### Task 2.4: KitsView.tsx (336 LOC) → Target: <250 LOC
- [ ] Extract view state management to custom hooks
- [ ] Simplify component to layout coordination

### Task 2.5: asyncStateManagement.ts (320 LOC) → Target: <250 LOC
- [ ] Split by state management domain
- [ ] Extract utility functions

### Task 2.6: formatConverter.ts (316 LOC) → Target: <250 LOC
- [ ] Extract format-specific converters
- [ ] Create converter factory pattern

### Task 2.7: scanService.ts (312 LOC) → Target: <250 LOC
- [ ] Extract scan strategies by file type
- [ ] Separate scanning orchestration from file processing

---

## 🔄 Medium Priority (Phase 3) - Component Complexity

### Task 3.1: Simplify Complex Components (26 files 200-300 LOC)
**Target**: Reduce components to <200 LOC where possible

**Strategy**:
- [ ] Extract business logic to custom hooks
- [ ] Break large components into smaller, focused components
- [ ] Move utility functions to separate files

### Task 3.2: Optimize Hook Complexity (22 complex hooks)
**Target**: Reduce hook returns to <12 fields, hook calls to <10

**Top Priority Hooks**:
- [ ] `useKitBrowser.ts` (33 returns) → Split into multiple focused hooks
- [ ] `useKitDetailsLogic.ts` (23 returns) → Extract validation and state hooks
- [ ] `useKitBankNavigation.ts` (12 returns) → Split navigation concerns

---

## 🔧 Implementation Guidelines

### Phase Execution Order
1. **Phase 1** (Critical): Address all 12 red flag files first
2. **Phase 2** (High): Tackle remaining large files  
3. **Phase 3** (Medium): Optimize component complexity

### Quality Gates for Each Task
- [ ] All existing tests pass
- [ ] New files follow architectural standards (50-200 LOC)
- [ ] TypeScript compilation successful
- [ ] ESLint passes without violations
- [ ] No new circular dependencies introduced
- [ ] Public APIs remain stable

### Testing Strategy
- [ ] Run `npm run analyze:architecture` before and after each refactoring
- [ ] Ensure health score improves with each task completion
- [ ] Maintain or improve test coverage
- [ ] Verify functionality with integration tests

## 📊 Success Metrics

### Target Architecture Health Improvements
- **Current Health Score**: 0/100
- **Phase 1 Target**: 60/100 (eliminate all red flags)
- **Phase 2 Target**: 80/100 (optimize remaining large files)
- **Phase 3 Target**: 90+/100 (excellent architectural health)

### File Distribution Targets
- **Tiny Files (<50 LOC)**: Maintain ~30%
- **Small Files (50-100 LOC)**: Increase to ~35%
- **Medium Files (100-200 LOC)**: Maintain ~25%
- **Large Files (200-300 LOC)**: Reduce to <10%
- **Red Flags (300+ LOC)**: Eliminate completely (0%)
- **Exceptions**: Maintain architectural constraints (preload script)

## 🚀 Getting Started

### Immediate Next Steps
1. **Start with Task 1.1** (syncService.ts) - highest impact
2. **Create feature branch** for each major refactoring
3. **Use analysis tools** to verify improvements: `npm run analyze:loc`
4. **Follow worktree workflow** for safe parallel development

### Monitoring Progress
```bash
# Check current architectural health
npm run analyze:architecture

# Focus on specific metrics
npm run analyze:loc              # Track LOC compliance
npm run analyze:complexity       # Monitor component complexity
```

---

**Note**: This roadmap should be treated as a living document. Update task status and priorities as work progresses and new analysis results become available.