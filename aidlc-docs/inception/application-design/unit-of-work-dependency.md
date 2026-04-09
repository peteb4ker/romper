# Unit of Work Dependency Matrix

## Execution Order (Strict Priority)

```
P0: Unit 1a → Unit 1b → Unit 1c
         (sequential within P0)
              |
              v
P1: Unit 2 + Unit 3
         (parallel within P1)
              |
              v
P2: Unit 4 + Unit 5 → Unit 6
         (4+5 parallel, 6 after 4)
              |
              v
P3: Unit 7 + Unit 8
         (parallel within P3)
              |
              v
     Build and Test (FR-10)
```

## Dependency Matrix

| Unit | Depends On | Reason |
|------|-----------|--------|
| 1a: Onboarding UX | None | Independent - UI changes to wizard components |
| 1b: Onboarding Resilience | 1a | Resilience builds on UX changes (error messages, pre-checks inform retry logic) |
| 1c: Onboarding Tests | 1a, 1b | Tests verify both UX and resilience changes |
| 2: E2E Reliability | P0 complete | E2E fixtures may need onboarding flow changes to be stable |
| 3: Code Quality | P0 complete | Structured logger may be used in onboarding; schema migration independent |
| 4: Test Gap Fill | P1 complete | Code quality audit (Unit 3) may reveal additional gaps |
| 5: Integration Coverage | P1 complete | E2E fixture improvements (Unit 2) inform integration test approach |
| 6: PBT | 4 | Needs base tests to exist before adding property-based variants |
| 7: App Signing | P2 complete | All tests must pass before signing release artifacts |
| 8: Docs Website | P2 complete, 1c | Onboarding docs feed into website; all features finalized first |

## Conflict Analysis

| Potential Conflict | Resolution |
|-------------------|------------|
| Unit 1a + 1b both modify wizard hooks | Sequential execution within P0 |
| Unit 3 (schema migration) + Unit 5 (integration tests) | P1 before P2; migration done before new integration tests |
| Unit 3 (logging) + Unit 1c (onboarding tests) | P0 before P1; tests written first, then logging utility may be used in tests |
| Unit 8 (docs) + Unit 1c (onboarding docs) | Unit 8 waits for 1c to complete; incorporates onboarding doc changes |

## Shared Resources

| Resource | Units | Access Pattern |
|----------|-------|---------------|
| Wizard components | 1a, 1c | 1a modifies, 1c tests |
| Wizard hooks | 1a, 1b, 1c | 1a/1b modify, 1c tests |
| E2E fixtures | 1c, 2 | 1c adds onboarding E2E, 2 fixes fixture infrastructure |
| Database schema | 3 | Only Unit 3 touches schema (migration) |
| GitHub Actions workflows | 2, 7 | 2 modifies e2e.yml, 7 modifies release.yml — no conflict |
| docs/manual/ | 1c, 8 | 1c updates getting-started, 8 adds FAQ/SEO/screenshots |
