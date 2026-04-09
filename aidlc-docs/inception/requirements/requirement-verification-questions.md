# Requirements Verification Questions

The reverse engineering and test coverage analysis revealed the following current state:
- **Unit tests**: 229 files, 3,383 tests — 87% statement coverage, 88% branch coverage (all thresholds passing)
- **Integration tests**: 17 files, 204 tests — 60% statement coverage
- **E2E tests**: 21 Playwright files (3 skipped)
- **~11 production files** lack co-located unit tests
- **Technical debt**: ~25 console.log statements, 5 large files (300+ LOC), broken coverage merge tooling

Please answer the following questions to clarify what "fully tested and ready to launch" means for this project.

---

## Question 1
What is your primary definition of "launch ready" for testing purposes?

A) Increase unit test coverage to a specific target (e.g., 90%+ across statements/branches/functions)
B) Fill the ~11 remaining untested production file gaps and fix technical debt (console.log, large files)
C) Ensure all test types work end-to-end: unit, integration, E2E, and coverage merge tooling — with zero skipped tests
D) Comprehensive audit: review existing test quality, fill gaps, fix debt, ensure all CI passes cleanly
E) Other (please describe after [Answer]: tag below)

[Answer]: B,C,D

## Question 2
The coverage merge tooling (nyc combining unit + integration reports) is broken — it reports 0/0. Should fixing this be in scope?

A) Yes — merged coverage reporting is important for launch confidence
B) No — individual suite reports (87% unit, 60% integration) are sufficient
C) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 3
There are ~25 console.log statements in production code (mostly in undo/redo hooks). What should we do with these?

A) Remove all console.log statements from production code
B) Replace with a structured logging utility (e.g., a logger with log levels)
C) Leave them — they're useful for debugging and this is a desktop app
D) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 4
Five files exceed the project's 300 LOC limit (syncService.ts at 867, preload/index.ts at 544, etc.). Should refactoring these be in scope for launch readiness?

A) Yes — refactor all files exceeding 300 LOC as part of this effort
B) Partial — only refactor if it blocks testing (e.g., files too complex to test as-is)
C) No — file size refactoring is separate from testing readiness
D) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 5
The 3 skipped E2E tests are in navigation flows. Should we fix and re-enable them?

A) Yes — zero skipped tests is a launch requirement
B) Investigate first — fix if the issue is real, delete if the tests are obsolete
C) No — E2E test gaps are acceptable for initial launch
D) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 6
The existing integration tests cover 60% of the electron/main code. Should we increase this?

A) Yes — target 80%+ integration coverage for the main process
B) Partial — add integration tests only for untested critical paths (sync, sample operations)
C) No — 60% integration + 87% unit is sufficient
D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7
Should we address the 38 npm audit vulnerabilities (6 low, 5 moderate, 27 high) as part of launch readiness?

A) Yes — resolve all vulnerabilities possible before launch
B) Partial — resolve high-severity vulnerabilities only
C) No — most are in dev dependencies and don't affect the shipped app
D) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 8
The deprecated `kits.artist` field still exists in the schema. Should we remove it?

A) Yes — clean up deprecated fields before launch
B) No — leave it, it's harmless and removal risks migration issues
C) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
C) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)
B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)
C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)
D) Other (please describe after [Answer]: tag below)

[Answer]: A
