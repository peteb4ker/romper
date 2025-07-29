# Technical Debt Todo List

_Last updated: 2025-07-25_

## Code Quality

- [ ] **Remove trailing whitespace from codebase**
  - Priority: High | Effort: Small | Risk: None
  - Run whitespace cleanup on all files
  - Add ESLint rule to catch trailing whitespace in future
  - Update editor settings documentation

- [ ] **Refactor duplicated error handling patterns**
  - Priority: Medium | Effort: Medium | Risk: Low
  - Standardize error handling across renderer hooks
  - Create shared error utility functions
  - Review file path validation duplication

- [ ] **Decompose SampleService class (630-line test indicates over-complexity)**
  - Priority: Medium | Effort: Large | Risk: Medium
  - Split into: SampleValidator, SampleCrudService, SampleMetadataService
  - Current single class handles file validation, CRUD operations, audio metadata, slot management
  - Large test file is symptom of Single Responsibility Principle violation
  - Will naturally result in smaller, focused test files
  - NOTE: Test file has clear sections: validateVoiceAndSlot, validateSampleFile, addSampleToSlot, deleteSampleFromSlot, validateSampleSources, replaceSampleInSlot - ideal for splitting

- [ ] **Decompose KitBrowser component (513-line test indicates over-complexity)**
  - Priority: Medium | Effort: Large | Risk: Medium
  - Split into: KitList component, BankNavigation component, DialogManager hook
  - Current component handles rendering, navigation, dialog management, keyboard interactions
  - Consider extracting custom hooks for complex interaction logic
  - Large test file indicates component has too many responsibilities

## Database Layer

- [ ] **Add structured error types to ORM layer**
  - Priority: Low | Effort: Medium | Risk: Low
  - Current: Simple string errors work fine
  - Enhancement: Error codes, structured details, better debugging
  - Only tackle if debugging becomes difficult

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
  - MIGRATED FILES: AboutView.test.tsx, KitsView.test.tsx, WizardSourceStep.test.tsx, useDb.test.ts, useKitPlayback.test.ts, useLocalStoreWizard.test.ts, useStartupActions.test.ts, useBankScanning.test.ts, useValidationResults.test.ts, SampleWaveform.test.tsx
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