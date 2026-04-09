# Units of Work

## Overview
10 units of work, executed in strict priority order (P0 → P1 → P2 → P3). No overlapping — each priority level completes before the next begins.

---

## Unit 1a: Onboarding UX (P0)
**FR**: FR-13 (partial)
**Scope**: User-facing improvements to the wizard flows

**Responsibilities:**
- Empty library guidance: post-"Blank Folder" next-steps modal
- Sample truncation transparency: inform user when 12-per-voice limit drops samples
- Better error messages: specific, actionable messages for SD card validation, network, permissions
- Progress transparency: estimated time, current operation detail, kit-by-kit progress
- Disk space pre-check before copy/download
- Write permission pre-check before initialization

**Key Files:**
- `app/renderer/components/wizard/WizardSourceStep.tsx`
- `app/renderer/components/wizard/WizardTargetStep.tsx`
- `app/renderer/components/wizard/WizardSummaryStep.tsx`
- `app/renderer/components/wizard/WizardProgressBar.tsx`
- `app/renderer/components/wizard/WizardErrorMessage.tsx`
- `app/renderer/components/LocalStoreWizardUI.tsx`
- `app/renderer/components/LocalStoreWizardModal.tsx`

**Acceptance Criteria:**
- [ ] Blank folder setup shows next-steps guidance after completion
- [ ] Sample skipping displays user-facing message with count
- [ ] SD card errors show path and expected folder format
- [ ] Target path validated for writability before initialization
- [ ] Disk space checked before download/copy operations
- [ ] Progress shows per-kit detail and estimated time

---

## Unit 1b: Onboarding Resilience (P0)
**FR**: FR-13 (partial)
**Scope**: Backend robustness for wizard initialization flows

**Responsibilities:**
- Download resume/retry for factory samples archive
- Cleanup on failure: remove partial extractions/copies
- Graceful degradation when local store path becomes inaccessible
- Handle wizard closure without completion (no corrupted state)

**Key Files:**
- `app/renderer/components/hooks/wizard/useLocalStoreWizard.ts`
- `app/renderer/components/hooks/wizard/useLocalStoreWizardState.ts`
- `app/renderer/components/hooks/wizard/useLocalStoreWizardFileOps.ts`
- `app/renderer/components/hooks/wizard/useLocalStoreWizardScanning.ts`
- `electron/main/services/archiveService.ts`
- `electron/main/services/localStoreService.ts`
- `app/renderer/components/dialogs/InvalidLocalStoreDialog.tsx`
- `app/renderer/components/dialogs/CriticalErrorDialog.tsx`

**Acceptance Criteria:**
- [ ] Factory download retries on network failure (at least 3 attempts)
- [ ] Partial files cleaned up on any initialization failure
- [ ] Wizard can be closed mid-initialization without leaving corrupted DB
- [ ] Invalid local store dialog offers clear recovery path (not just "exit")

---

## Unit 1c: Onboarding Tests (P0)
**FR**: FR-13 (partial)
**Scope**: Comprehensive test coverage for all onboarding error paths + documentation

**Responsibilities:**
- Unit tests for ALL wizard hook error paths
- Integration tests for localStoreService, archiveService, scanService error paths
- E2E tests for each wizard path including error recovery flows
- Documentation updates (getting-started.md, troubleshooting)

**Key Test Gaps:**
- SD card validation failure (invalid/empty folder)
- Network timeout/failure during archive download
- Disk space exhaustion mid-initialization
- Permission denied on target directory
- Wizard closure without completion
- Sample truncation behavior (>12 samples per voice)
- Database initialization failure

**Documentation Updates:**
- `docs/manual/getting-started.md`: disk space requirements, network requirements, kit naming, next steps after blank folder
- New troubleshooting section for common wizard errors

**Acceptance Criteria:**
- [ ] Every wizard error path has at least one unit test
- [ ] Integration tests cover localStoreService + archiveService failures
- [ ] E2E tests cover all 3 wizard paths + at least 2 error recovery scenarios
- [ ] Getting-started.md updated with requirements and troubleshooting

---

## Unit 2: E2E Reliability (P1)
**FR**: FR-4
**Scope**: Fix E2E test suite reliability in GitHub Actions

**Responsibilities:**
- Update E2E fixture to include actual sample files
- Fix sync tests to exercise real sync workflow
- Fix navigation test to fail loudly instead of silently skipping
- Add Xvfb readiness validation with retry logic
- Add fixture extraction error reporting and retry

**Acceptance Criteria:**
- [ ] E2E fixture contains sample WAV files for sync testing
- [ ] Sync tests exercise real file copy/convert operations
- [ ] Navigation test fails explicitly if fixture data missing
- [ ] Xvfb validated with retry before test execution
- [ ] Zero skipped tests, zero false positives
- [ ] CI reliable across ubuntu, macos, windows

---

## Unit 3: Code Quality (P1)
**FR**: FR-2, FR-5, FR-6, FR-7, FR-8
**Scope**: Test audit, structured logging, schema cleanup, npm fixes, conditional refactoring

**Responsibilities:**
- FR-2: Audit existing test quality (error paths, shallow tests, mocks)
- FR-5: Create structured logger utility, replace ~25 console.log statements
- FR-6: Remove deprecated kits.artist field (migration + code cleanup)
- FR-7: Resolve high-severity npm audit vulnerabilities
- FR-8: Refactor large files only if they block testing

**Acceptance Criteria:**
- [ ] Test audit report identifying shallow/missing error path tests
- [ ] Logger utility with debug/info/warn/error levels
- [ ] Zero console.log in production code (SECURITY-03 compliant)
- [ ] kits.artist column removed via migration
- [ ] High-severity npm vulnerabilities resolved
- [ ] Large files assessed; refactored if blocking testability

---

## Unit 4: Test Gap Fill (P2)
**FR**: FR-1
**Scope**: Add unit tests for ~11 untested production files

**Responsibilities:**
- 2 custom hooks (usePopoverDismiss, useKitGridKeyboard)
- 3 React UI components (GainKnob, DrumKit, StereoIcon)
- 1 CRUD operation (sampleMovement.ts)
- 4 constant/utility files

**Acceptance Criteria:**
- [ ] All ~11 files have co-located __tests__/ with meaningful assertions
- [ ] Unit test coverage maintained at 85%+

---

## Unit 5: Integration Coverage (P2)
**FR**: FR-3
**Scope**: Increase integration test coverage from 60% to 80%+

**Responsibilities:**
- Add integration tests for untested critical paths in electron/main
- Sync operations end-to-end
- Sample management operations
- Database CRUD operations

**Acceptance Criteria:**
- [ ] Integration test coverage >= 80% statements
- [ ] All critical main process paths covered

---

## Unit 6: Property-Based Testing (P2)
**FR**: FR-9
**Scope**: Add fast-check PBT framework and property-based tests

**Responsibilities:**
- Install and configure fast-check for Vitest
- Create domain-specific generators (Kit, Voice, Sample)
- Identify testable properties (round-trip, invariant, idempotency)
- Implement PBT tests per PBT-01 through PBT-10 rules
- Ensure shrinking and seed-based reproducibility

**Acceptance Criteria:**
- [ ] fast-check installed and integrated with Vitest
- [ ] Domain generators created for core types
- [ ] Round-trip tests for serialization/deserialization
- [ ] Invariant tests for data transformations
- [ ] Idempotency tests for normalization operations
- [ ] All PBT rules compliant

---

## Unit 7: App Signing (P3)
**FR**: FR-11
**Scope**: macOS + Windows code signing for release builds

**Responsibilities:**
- Create entitlements.plist for macOS hardened runtime
- Configure osxSign + osxNotarize in forge.config.cjs
- Configure Squirrel maker signing for Windows
- Add signing steps to release.yml workflow
- Update pre-release validation script
- Document required GitHub secrets setup

**Acceptance Criteria:**
- [ ] entitlements.plist created and referenced
- [ ] forge.config.cjs signing config active (env-var driven)
- [ ] release.yml has macOS signing + notarization steps
- [ ] release.yml has Windows Azure Trusted Signing steps
- [ ] Pre-release validation checks signing environment
- [ ] README/docs document secret setup requirements

---

## Unit 8: Docs Website (P3)
**FR**: FR-12
**Scope**: Website launch readiness at https://peteb4ker.github.io/romper/

**Responsibilities:**
- Add 8-10 feature-specific screenshots
- Create FAQ section
- Add SEO essentials (sitemap.xml, robots.txt, Schema.org)
- Create Getting Help / Community section
- Add Troubleshooting guide
- Update content to reflect onboarding improvements from Unit 1

**Acceptance Criteria:**
- [ ] 8+ screenshots covering all major features
- [ ] FAQ with 6+ common questions answered
- [ ] sitemap.xml and robots.txt present
- [ ] Troubleshooting guide for top 5 user issues
- [ ] Community/support links visible
