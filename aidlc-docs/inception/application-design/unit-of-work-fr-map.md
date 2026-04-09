# Unit of Work — Functional Requirements Map

## FR to Unit Mapping

| FR | Description | Unit | Priority |
|----|-------------|------|----------|
| FR-13 | Onboarding UX improvements | 1a: Onboarding UX | P0 |
| FR-13 | Onboarding resilience | 1b: Onboarding Resilience | P0 |
| FR-13 | Onboarding tests and docs | 1c: Onboarding Tests | P0 |
| FR-4 | E2E test reliability in CI | 2: E2E Reliability | P1 |
| FR-2 | Test quality audit | 3: Code Quality | P1 |
| FR-5 | Structured logging | 3: Code Quality | P1 |
| FR-6 | Remove deprecated schema field | 3: Code Quality | P1 |
| FR-7 | npm vulnerability fixes | 3: Code Quality | P1 |
| FR-8 | Conditional large file refactoring | 3: Code Quality | P1 |
| FR-1 | Fill remaining test gaps | 4: Test Gap Fill | P2 |
| FR-3 | Integration coverage to 80%+ | 5: Integration Coverage | P2 |
| FR-9 | Property-based testing | 6: PBT | P2 |
| FR-11 | macOS + Windows app signing | 7: App Signing | P3 |
| FR-12 | Docs website launch readiness | 8: Docs Website | P3 |

## FR-10 (CI Passes Cleanly)
Not mapped to a specific unit — validated in the **Build and Test** phase after all units complete.

## Coverage Verification

All 13 FRs are mapped:
- FR-1 → Unit 4
- FR-2 → Unit 3
- FR-3 → Unit 5
- FR-4 → Unit 2
- FR-5 → Unit 3
- FR-6 → Unit 3
- FR-7 → Unit 3
- FR-8 → Unit 3
- FR-9 → Unit 6
- FR-10 → Build and Test
- FR-11 → Unit 7
- FR-12 → Unit 8
- FR-13 → Units 1a, 1b, 1c
