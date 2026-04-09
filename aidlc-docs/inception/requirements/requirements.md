# Requirements: Comprehensive Testing for Launch Readiness

## Intent Analysis
- **User Request**: Fully test the application so it's ready to launch. Get from 95% to 100%.
- **Request Type**: Enhancement (comprehensive testing + technical debt cleanup)
- **Scope**: System-wide — all layers (renderer, main process, shared, E2E)
- **Complexity**: Moderate — strong foundations exist, work is gap-filling not greenfield
- **Depth**: Standard

## Current State (Measured 2026-04-08)

| Metric | Value |
|--------|-------|
| Unit tests | 229 files, 3,383 tests, 87% statements, 88% branches |
| Integration tests | 17 files, 204 tests, 60% statements |
| E2E tests | 21 Playwright files (3 skipped) |
| Source files without tests | ~11 production files |
| All thresholds | Passing (85% lines/branches, 80% functions) |

## Functional Requirements

### FR-13: Onboarding Flow Hardening (PRIORITY)
Harden the first-time user experience across all three wizard paths (SD Card, Factory Samples, Blank Folder) to prevent new user frustration and abandonment.

**UX Improvements:**
- Empty library guidance: after "Blank Folder" setup, show next-steps modal (import from SD, download samples, or create first kit)
- Sample truncation transparency: when 12-per-voice limit is hit, inform user which samples were skipped (currently silent, dev-mode log only)
- Better error messages: replace generic errors with specific guidance (e.g., "SD card at /Volumes/RAMPLE does not contain kit folders — expected folders named like A0, B1, Drum01" instead of "No valid kit folders found")
- Progress transparency: show estimated time, current operation detail, and kit-by-kit progress during initialization
- Disk space pre-check: validate sufficient space before starting copy/download
- Write permission pre-check: verify target path is writable before initializing

**Resilience:**
- Download resume/retry for 500MB factory samples archive (currently fails completely on network drop with no resume)
- Cleanup on failure: remove partial extractions/copies when initialization fails mid-way
- Graceful degradation when local store path becomes inaccessible (currently shows blocking modal with no helpful recovery)
- Handle wizard closure without completion (ensure no corrupted state)

**Comprehensive Test Coverage:**
- Unit tests for ALL error paths in wizard hooks:
  - SD card validation failure (invalid/empty folder selected)
  - Network timeout/failure during archive download
  - Disk space exhaustion mid-initialization
  - Permission denied on target directory
  - Wizard closure without completion
  - Sample truncation behavior (>12 samples per voice)
  - Database initialization failure
- Integration tests for localStoreService, archiveService, scanService error paths
- E2E tests for each wizard path including error recovery flows

**Documentation:**
- Add disk space requirements to getting-started.md (~1GB for factory samples)
- Add network requirements (internet needed for factory download)
- Add troubleshooting section for common wizard errors
- Document kit naming requirements for SD card import
- Add "what to do next" guidance after blank folder setup
- Explain 12-sample-per-voice limit and what happens to extras

**Key Files:**
- `app/renderer/components/wizard/` (6 components)
- `app/renderer/components/hooks/wizard/` (4 hooks)
- `app/renderer/components/LocalStoreWizardUI.tsx`
- `app/renderer/components/LocalStoreWizardModal.tsx`
- `electron/main/services/localStoreService.ts`
- `electron/main/services/archiveService.ts`
- `electron/main/services/scanService.ts`
- `app/renderer/components/dialogs/InvalidLocalStoreDialog.tsx`
- `app/renderer/components/dialogs/CriticalErrorDialog.tsx`
- `docs/manual/getting-started.md`

### FR-1: Fill Remaining Test Gaps
Add unit tests for the ~11 production files that lack co-located tests:
- 2 custom hooks (usePopoverDismiss, useKitGridKeyboard)
- 3 React UI components (GainKnob, DrumKit, StereoIcon)
- 1 CRUD operation (sampleMovement.ts)
- 4 constant/utility files

### FR-2: Comprehensive Test Quality Audit
Review existing test quality across all 229 unit test files and 17 integration test files:
- Verify tests cover error paths, not just happy paths
- Check for shallow tests (assertions that don't test meaningful behavior)
- Ensure mocks are appropriate and not hiding bugs
- Validate edge case coverage

### FR-3: Increase Integration Test Coverage to 80%+
Current integration coverage is 60%. Target 80%+ by adding integration tests for:
- All untested critical paths in electron/main
- Sync operations end-to-end
- Sample management operations
- Database CRUD operations

### FR-4: Fix E2E Test Reliability in GitHub Actions
The E2E test suite has critical reliability issues in CI:

**Skipped/False-Positive Tests:**
- 1 conditionally skipped navigation test (`navigation.e2e.test.ts:383`) — silently skips when fixture doesn't load kit data
- 2 sync tests (`sync-real-operations.e2e.test.ts`) are false positives — they pass but never test actual sync because the fixture has no sample files

**CI Infrastructure Issues:**
- Xvfb (Linux virtual display) setup has no real validation — sleeps 5s then runs non-blocking check
- Chrome sandbox configuration doesn't verify success, continues silently on failure
- Fixture extraction (`e2e-fixture-extractor.ts`) fails silently with no retry logic

**Required Fixes:**
- Update E2E fixture (`local-store-fixture.tar.gz`) to include actual sample files
- Fix sync tests to exercise real sync workflow, not "no files to sync" path
- Fix navigation test to fail loudly instead of silently skipping
- Add Xvfb readiness validation with retry logic in `e2e.yml`
- Add fixture extraction error reporting and retry
- Target: zero skipped tests, zero false positives, reliable CI across ubuntu/macos/windows

### FR-5: Replace console.log with Structured Logging
Replace ~25 console.log statements in production code with a structured logging utility:
- Create a logger with log levels (debug, info, warn, error)
- Replace all console.log in useUndoActionHandlers.ts (~8), useUndoRedo.ts (~8), useSyncUpdate.ts (~2), romperDb.ts (~1)
- Ensure no sensitive data is logged (SECURITY-03 compliance)

### FR-6: Remove Deprecated Schema Field
Remove the deprecated `kits.artist` field from the Drizzle ORM schema:
- Create a new migration to drop the column
- Update all code references
- No backward compatibility needed (no users yet)

### FR-7: Resolve High-Severity npm Vulnerabilities
Address the high-severity npm audit vulnerabilities:
- Run `npm audit fix` for automatic fixes
- Manually resolve remaining high-severity issues
- Low and moderate vulnerabilities are out of scope

### FR-8: Refactor Large Files (Conditional)
Refactor files exceeding 300 LOC only if their size blocks effective testing:
- syncService.ts (867 LOC)
- preload/index.ts (544 LOC)
- sampleService.ts (961 LOC)
- SyncUpdateDialog.tsx (406 LOC)
- KitGrid.tsx (338 LOC)

If these files are testable as-is, skip refactoring.

### FR-9: Property-Based Testing
Add property-based tests using fast-check (PBT-09) for:
- Serialization/deserialization round-trips (PBT-02)
- Data transformation invariants (PBT-03)
- Idempotent operations (PBT-04)
- Stateful component testing where applicable (PBT-06)
- All PBT rules (PBT-01 through PBT-10) enforced as blocking constraints

### FR-10: Ensure All CI Passes Cleanly
All CI/CD checks must pass:
- TypeScript compilation (zero errors)
- ESLint (zero warnings)
- All unit tests passing
- All integration tests passing
- All E2E tests passing (zero skipped, zero false positives)
- Build succeeds

### FR-11: macOS and Windows App Signing
Implement code signing for release builds. A comprehensive strategy document already exists at `docs/developer/code-signing.md`.

**macOS (codesigning + notarization):**
- Create `electron/resources/entitlements.plist` for hardened runtime
- Uncomment and configure `osxSign` + `osxNotarize` in `forge.config.cjs`
- Add macOS signing steps to `.github/workflows/release.yml`
- Configure GitHub secrets (APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID)
- Requires Apple Developer Program ($99/year)

**Windows (Authenticode via Azure Trusted Signing):**
- Add Azure Trusted Signing GitHub Action to `release.yml`
- Configure Squirrel maker with signing params in `forge.config.cjs`
- Configure GitHub secrets (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_SIGNING_ACCOUNT, AZURE_CERTIFICATE_PROFILE)
- Requires Azure Trusted Signing ($9.99/month, pay-per-release)

**Validation:**
- Update `scripts/release/validate.js` to check signing environment
- Verify signed artifacts in CI

### FR-12: Documentation Website Launch Readiness
Ensure `docs/` site at https://peteb4ker.github.io/romper/ is optimal for OSS launch.

**Current State:** Landing page is excellent, user manual comprehensive (7 pages), developer docs extensive (19 files).

**Required Additions (Tier 1 — before launch):**
- Add feature-specific screenshots (8-10 total: Kit Browser, Kit Editor voices, Step Sequencer, Sync dialog, Settings)
- Create FAQ section (How is this different? Format support? Data safety? Undo? SD card compatibility?)
- Add SEO essentials: sitemap.xml, robots.txt, Open Graph meta expansion, Schema.org structured data
- Create Getting Help / Community section (GitHub Issues, Discussions)
- Add Troubleshooting guide (SD card detection, missing samples, sync errors, audio playback)

**Recommended (Tier 2 — first month post-launch):**
- Record 2-3 minute product demo video
- Create Release Notes page from CHANGELOG.md
- Add system requirements matrix (OS versions, disk space, RAM)
- Publish public roadmap or "what's next" page

## Non-Functional Requirements

### NFR-1: Test Coverage Targets
- Unit test coverage: maintain 85%+ (currently 87%)
- Integration test coverage: increase to 80%+ (currently 60%)
- Zero skipped tests across all suites

### NFR-2: Security Compliance (Extension Enabled)
All SECURITY rules (SECURITY-01 through SECURITY-15) enforced as blocking constraints.
Key applicable rules for this desktop app:
- SECURITY-03: Structured logging (no ad-hoc console.log)
- SECURITY-04: CSP headers (Electron HTML)
- SECURITY-05: Input validation on IPC parameters
- SECURITY-09: No default credentials, safe error handling
- SECURITY-10: Dependency pinning, vulnerability scanning
- SECURITY-15: Exception handling, fail-safe defaults

Many cloud/network rules (SECURITY-01, 02, 06, 07, 08, 11, 12, 14) are N/A for this offline desktop app.

### NFR-3: Property-Based Testing Compliance (Extension Enabled)
All PBT rules (PBT-01 through PBT-10) enforced as blocking constraints.
- fast-check framework for TypeScript/Vitest integration
- Domain-specific generators for Kit, Voice, Sample types
- Round-trip, invariant, and idempotency properties tested
- Shrinking and reproducibility via seeds

## Out of Scope
- Coverage merge tooling fix (nyc reporting 0/0) — individual reports sufficient
- Low/moderate npm vulnerabilities
- Large file refactoring unless it blocks testing
- New feature development
- UI/UX changes in the app itself (except onboarding flows per FR-13)
- Purchasing signing certificates (user action — documented as prerequisites)
- Demo video recording (Tier 2, post-launch)
