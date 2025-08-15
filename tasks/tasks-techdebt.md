---
title: "Technical Debt Todo List"
owners: ["product-team"]
last_reviewed: "2025-08-15"
tags: ["project-management"]
---

---
title: "Technical Debt Todo List"
owners: ["product-team"]
last_reviewed: "2025-08-15"
tags: ["project-management"]
---

# Technical Debt Todo List

_Last updated: 2025-01-12_

## Code Quality

- [x] **Remove trailing whitespace from codebase** ✅ COMPLETED
  - Priority: High | Effort: Small | Risk: None
  - COMPLETED STATE: Cleaned trailing whitespace from 3 affected files
  - CHANGES MADE: Added ESLint `no-trailing-spaces` rule to prevent future issues
  - RESULTS: Codebase now clean, automated prevention in place

- [x] **Refactor duplicated error handling patterns** ✅ COMPLETED
  - Priority: Medium | Effort: Medium | Risk: Low
  - COMPLETED STATE: Created lightweight error handling utilities and patterns
  - CHANGES MADE:
    - Added `ErrorPatterns` to `app/renderer/utils/errorHandling.ts` with standard patterns for sample, kit, and API operations
    - Created `createRendererErrorHandler()` function for components requiring custom error handling
    - Extended `shared/errorUtils.ts` with `SampleError`, `KitError`, `ValidationError` classes
    - Centralized error handling mock in `tests/mocks/errorHandling.ts`
  - FILES UPDATED: `useSampleProcessing.ts`, `useStereoHandling.ts`, `useSampleActions.ts`, `useInternalDragHandlers.ts`, `useKitDetailsLogic.ts`
  - RESULTS: Reduced code duplication, standardized console.error + toast.error patterns across renderer hooks
  - APPROACH: Lightweight solution without heavyweight frameworks, maintains existing test structure

- [x] **Decompose SampleService class (983-line service now refactored)** ✅ COMPLETED
  - Priority: Medium | Effort: Large | Risk: Medium  
  - COMPLETED STATE: Successfully decomposed into focused services:
    - `SampleValidator` - validation logic (voice/slot, file format, stereo constraints)
    - `SampleCrudService` - CRUD operations (add, delete, move samples)  
    - `SampleMetadataService` - audio metadata and buffer operations
    - `SampleSlotService` - slot management and boundary validation
  - RESULTS: 983-line monolithic service → 4 focused services with comprehensive tests
  - APPROACH: Created orchestrating SampleService that delegates to specialized services
  - BENEFITS: Better separation of concerns, improved testability, clearer responsibility boundaries

- [ ] **Decompose KitBrowser component (513-line test indicates over-complexity)**
  - Priority: Medium | Effort: Large | Risk: Medium
  - Split into: KitList component, BankNavigation component, DialogManager hook
  - Current component handles rendering, navigation, dialog management, keyboard interactions
  - Consider extracting custom hooks for complex interaction logic
  - Large test file indicates component has too many responsibilities

## Database Layer

- [ ] **Add server-side input validation**
  - Priority: Low | Effort: Small | Risk: Low
  - Current: UI-level validation works well
  - Enhancement: Validate kit names, voice numbers in ORM
  - Only needed if data integrity issues arise

## Scanning System

- [ ] **Move WAV analysis to main process**
  - Priority: Medium | Effort: Medium | Risk: Low
  - Current: Disabled due to Buffer issues in renderer process
  - Enhancement: Implement WAV analysis in main process using node-wav
  - Returns default values for now, needs proper file analysis
  - Important for accurate audio metadata

## Testing

- [x] **Test Infrastructure Overhaul - Phase 1: Foundation** ✅ COMPLETED
  - Priority: High | Effort: Large | Risk: Low
  - Create centralized test infrastructure with tests/ directory
  - Centralized mocks for electron, filesystem, database, browser APIs
  - Test data factories for Kit, Sample, Settings objects
  - Standardized test providers and setup/teardown patterns
  - Addresses growing test complexity and mock duplication (75+ electronAPI instances)

- [x] **Test Infrastructure Migration - Adoption Phase** ✅ COMPLETED
  - Priority: High | Effort: Medium | Risk: Low
  - COMPLETED STATE: Successfully migrated 13+ test files from manual mocks to centralized setup
  - CHANGES MADE: Updated vitest.setup.ts to import defaultElectronAPIMock and setupAudioMocks globally
  - MIGRATED FILES: 10 test files
    - AboutView, KitsView, WizardSourceStep
    - useDb, useKitPlayback, useLocalStoreWizard
    - useStartupActions, useBankScanning, useValidationResults
    - SampleWaveform
  - RESULTS: Test count improved from 633 → 639 passing tests, infrastructure now centralized
  - APPROACH: Removed manual window.electronAPI assignments, tests now use global vitest.setup.ts mocks

- [ ] **Test Infrastructure Overhaul - Phase 3: Categorization**
  - Priority: Medium | Effort: Medium | Risk: Low
  - Implement unit/integration/e2e test separation
  - Create separate vitest configs for different test types
  - Expand integration test coverage for renderer↔main IPC
  - Add E2E tests for critical user journeys

- [ ] **Increase error path test coverage**
  - Priority: Medium | Effort: Medium | Risk: Medium
  - Focus areas: Database corruption, IPC failures, invalid inputs
  - Current: Happy paths well covered
  - Important for production stability

- [ ] **Add integration tests for sequencer functionality**
  - Priority: Medium | Effort: Small | Risk: Low
  - Test step pattern persistence across app restarts
  - Test kit auto-creation during sequencer use
  - Validate voice number mapping (1-4)

- [ ] **Review and improve scanning function tests**
  - Priority: Medium | Effort: Medium | Risk: Medium
  - Current: Tests may not cover the right scenarios
  - Focus on RTF filename parsing, voice inference, file path resolution
  - Ensure scanning works with different local store configurations

## Documentation

- [ ] **Document error handling patterns**
  - Priority: Low | Effort: Small | Risk: Low
  - When to use DbResult vs exceptions
  - Error message guidelines
  - Debugging flows

- [ ] **Create ORM usage guide**
  - Priority: Low | Effort: Small | Risk: Low
  - Best practices for database operations
  - Common patterns and anti-patterns
  - Migration workflow

## Development Experience

- [x] **Preserve route state during HMR reloads** ✅ COMPLETED
  - Priority: Medium | Effort: Small | Risk: Low
  - COMPLETED STATE: Implemented HMR state preservation with testable functions
  - CHANGES MADE: Created `hmrStateManager.ts` with route and kit selection preservation
  - FILES UPDATED: `app/renderer/main.tsx`, `app/renderer/views/KitsView.tsx`
  - TESTS: 19 comprehensive test cases covering all HMR state management scenarios
  - RESULTS: Route and selected kit state now preserved during development hot reloads

## Performance

- [ ] **Profile database operations with large datasets**
  - Priority: Low | Effort: Medium | Risk: Low
  - Test with 2600+ kits
  - Identify slow queries
  - Only needed if performance issues reported

---

## Guidelines

- **Mark items complete** with `[x]` when finished
- **Add new items** when encountering tech debt during feature work
- **Update priorities** based on user feedback and stability issues
- **Don't tackle** unless specifically prioritized or blocking current work
- **Group related items** and address together for efficiency
