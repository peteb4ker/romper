<!--
layout: default
title: Coding Guide
-->

# Romper Coding Guide

Conventions that aren't obvious from the code. ESLint and Prettier enforce
formatting, import/key ordering (perfectionist, alphabetical), `no-explicit-any`,
floating promises, and a cognitive-complexity limit; run `npm run lint` to
auto-fix what can be fixed. See [architecture.md](architecture.md) for how
the pieces fit.

## Components and hooks

- Components render; logic lives in hooks under
  `app/renderer/components/hooks/<domain>/` (`kit-management`,
  `sample-management`, `voice-panels`, `wizard`, `shared`). For example,
  `KitEditor` gets its state and handlers from `useKitEditorLogic`.
- Keep a hook to one job. When one grows several unrelated concerns, split it
  and compose the pieces in a `use<Thing>Logic` hook.
- Show user-facing errors through `useMessageApi()` (the
  `MessageDisplayContext`), with a sentence the user can act on rather than
  the raw error. Don't call `useMessageDisplay()` in a component: it creates
  a separate message store that nothing renders (RE-11).
- Memoize where profiling or list size calls for it. `KitGrid` virtualizes
  with react-window; follow that pattern for any other long list.

## Rample behaviour

Any statement about how the Squarp Rample behaves, in code comments, docs,
tests or issues, quotes the [Rample manual](https://squarp.net/rample/manual/)
or is marked "unverified on hardware". Romper's own design choices are
written as Romper's, not as the module's. For example, "stereo is a voice
setting" is Romper's design; the manual says only "A stereo sample will
fill 2 mono voices."

## Keyboard shortcuts

- A plain-key shortcut that must work in the kit browser and elsewhere
  uses a number or a special character only, with no Shift (Pete, #552).
  Letters are reserved for bank jumps in the browser. `;` toggles a
  favorite in both the browser and the editor.
- Standard Cmd/Ctrl menu shortcuts are exempt, Shift included: for
  example Cmd/Ctrl+Shift+S for Scan All and Cmd/Ctrl+Shift+Z for Redo.
  The bank jump ignores presses with Cmd or Ctrl held, so they don't clash.
- Match on `KeyboardEvent.key`, not `code`, so the shortcut follows the
  keyboard layout, and keep shared matchers in
  `app/renderer/utils/keyboardShortcuts.ts` (`isFavoriteKey`).
- Single-key shortcuts ignore presses with Cmd, Ctrl or Alt held
  (`hasCommandModifier`), keys typed in a text field, and keys pressed while
  a modal dialog is open (`isModalDialogOpen`).
- Choosing a shortcut, like any wording or behaviour choice, is a product
  decision: it needs Pete's sign-off recorded on the issue before it's
  built.

## IPC and the database

- Renderer code calls main only through `globalThis.electronAPI`, whose type
  is `ElectronAPI` in `shared/electronApi.ts`. To add a call:
  1. Add the method to `ElectronAPI`.
  2. Implement it in `electron/preload/index.ts`.
  3. Register the handler with `ipcMain.handle` in main.
  4. Add it to the default mock in `tests/mocks/`.

  `ipcChannelParity.test.ts` fails if the preload and main channels drift.
- Database functions return `DbResult<T>` (`{ success, data?, error? }`).
  Build failures with `createErrorResult` / `getErrorMessage` from
  `@romper/shared/errorUtils`.
- Drizzle runs on synchronous better-sqlite3. Always end a query with
  `.all()`, `.get()`, `.run()`, or `.values()`, and never `await` a query or
  pass an `async` callback to `db.transaction`.

  ```ts
  const editable = db.select().from(kits).where(eq(kits.editable, true)).all();
  ```

- Schema changes go through `shared/db/schema.ts` plus a generated migration
  (`npm run db:generate`), and [romper-db.md](romper-db.md) gets updated.

## Types and imports

- Import across layers with the `@romper/app/*`, `@romper/electron/*`, and
  `@romper/shared/*` aliases. `electron/main` may import only from `shared`.
- Use ES module `import`. The exceptions are the preload (Electron loads it as
  CommonJS) and tests.
- `npm run typecheck` covers `app/`, `electron/` (minus the preload), and
  `shared/` through `tsconfig.json`, and test code through
  `tsconfig.test.json`: so far `tests/` (except `tests/e2e/`), the tests in
  `shared/`, `electron/main/` and `electron/preload/`, the `app/` test
  folders listed there, and `vitest.setup.ts`. The other `app/` tests and
  the e2e specs aren't type-checked yet (#466); add a folder to
  `tsconfig.test.json` once its errors are fixed. The preload is
  type-checked by its own build (`npm run build:preload`).
- jest-dom's matchers (`toBeInTheDocument` and the rest) are typed through
  `@testing-library/jest-dom/vitest`, which `vitest.setup.ts` imports. When
  a test mocks `useSettings`, build its value with `createMockSettings`
  (`tests/mocks/settings.ts`), and build rows with the factories in
  `tests/factories/`, so the fixtures match the real types.
- In a typed test, give mocks the real signature
  (`Mock<Parameters<typeof useHook>[0]["onPlay"]>`) and a mocked hook a
  full return value (`ReturnType<typeof useHook>`), not a cast. To test
  code without the IPC bridge, use `vi.stubGlobal("electronAPI", undefined)`
  (and `vi.unstubAllGlobals()` after), or
  `setupElectronAPIMock({ someMethod: undefined })` for one missing method.

## Tests

- Unit tests go in a `__tests__/` directory next to the code, named
  `<file>.test.ts(x)`, and run in jsdom. Integration tests go in
  `tests/integration/*.integration.test.ts` and run inside Electron.
  E2E tests are `*.e2e.test.ts` (mostly `tests/e2e/`).
- An integration test that needs a store on disk makes it with
  `createTempStore("<prefix>-")` and deletes it with `removeTempStore(dir)`
  in `afterEach` (`tests/integration/support/tempStore.ts`). Don't close
  database connections yourself first: the integration runner closes them
  all when each test ends, before `afterEach` runs, so a test can't leave
  a database open for Windows to refuse to delete. A plain `fs.rmSync` in
  `afterEach` works too; `removeTempStore` also retries and is safe in
  `afterAll`.
- E2E specs import `test` and `expect` from `tests/utils/e2e-error-guard`,
  not `@playwright/test`. The guard watches every app a test launches and
  fails the test on an error-level message nobody expected: a renderer
  `console.error`, an uncaught page error, an error toast, the error
  boundary or the wizard's error, or a line on the main process's stderr.
  A spec that triggers errors on purpose declares them, keyed by the reason:
  `test.use({ expectedMessages: { "<reason>": { pattern, sources } } })`. Unexpected
  warnings are listed as test annotations and don't fail the test.
- Known noise: main-process stderr that Chromium, the OS or the test
  harness writes, not Romper, is listed in
  `tests/validation/support/known-noise.ts`. The e2e guard and the
  full-pipeline validation both ignore a stderr line that matches an entry
  on one of its platforms; every other stderr line stays an error (a
  warning if it says "warn"), and the list never applies to renderer
  console errors, page errors or the UI. When a run fails on a line
  Romper didn't write, add to the list rather than to one spec:
  - one entry per source (the Chromium component, the OS service); a new
    line from a listed source widens that entry's pattern;
  - a pattern as narrow as the line allows (Chromium's file name and the
    message, not just `ERROR`);
  - the `platforms` it's been seen on, or its cause applies to; it's
    still an error elsewhere;
  - a `reason` saying why it isn't Romper's error (required; the unit test
    fails without it), and a `link` to the issue, upstream bug or
    upstream code that logs it where there is one;
  - a real line from the failing run in `examples`, which the unit test
    checks the pattern matches.

  An error Romper itself logs on purpose isn't noise: declare it in the
  spec's `expectedMessages`.
- Pull requests that change only tests or docs (`tests/`, `__tests__/`,
  `*.test.*` and `*.spec.*` files, `docs/`, `aidlc-docs/`, Markdown) run
  e2e on Linux only. Any other change, to the app, `electron/`, `shared/`,
  scripts, `package.json`, the lockfile, the workflows or the Playwright
  config, runs e2e on Linux, macOS and Windows, as do pushes to `main`.
  CI splits the suite into shards (`--shard`) on each platform; the `plan`
  job in `e2e.yml` sets how many. `e2e-tests-check` passes only when every
  shard on every platform passed, and its job summary adds the shards up.
- On CI, Playwright retries a failed e2e test once (`retries` in
  `playwright.config.ts`), so one flaky test doesn't fail the run; locally
  it doesn't retry. A test that passed only on retry is flaky, not
  passing: the e2e job's summary lists it under "E2E retries", with the
  first attempt's failure, and annotates the spec. **File each one as an
  issue**, labelled as [`BACKLOG.md`](../../BACKLOG.md) says (the spec's
  use case, kind `test`, or `bug` if the app is at fault), with the
  failure and a link to the run; then fix the cause. The error
  guard isn't retried away: if a test's first attempt reported an
  unexpected error, its retry fails too.
- The full-pipeline validation (`tests/validation/*.validation.ts`) is not
  part of any suite. `npm run validate:full` builds the app, then sets up a
  store from the factory archive, adds a kit with stereo samples, writes it
  to a folder and compares every card file byte for byte. It fails on any
  error or warning the app shows or logs that the scenario doesn't expect.
  The report is `validation-report/report.md`. Options: `--fresh` downloads
  the archive from Squarp instead of the copy in `~/.cache/romper`;
  `--headed` shows the window; `--keep` keeps the temp store and card;
  `--no-build` reuses the build. The "Full-Pipeline Validation" workflow
  runs it on all three platforms on demand. Plan:
  [`validation-and-traceability.md`](validation-and-traceability.md).
- Mock collaborators and test the unit's behavior. Reuse the shared mocks and
  factories in `tests/mocks/` and `tests/factories/`.
- To change IPC behavior in a test, use
  `vi.mocked(globalThis.electronAPI.someMethod).mockResolvedValue(...)`.
  Assigning `window.electronAPI` is a lint error, and reassigning
  `global.window` breaks `globalThis.electronAPI`.
- Don't `.skip` a failing test; fix the cause.

## Fixing a bug

- Look for siblings: other callers or code paths with the same bug. Fix
  them in the same PR or file issues for them, and list them in the PR
  description either way.
- Cite code by symbol and file, not line number, in issues, PRs and docs.

## Parallel work and shared interfaces

- When work is split across parallel sessions or agents, shared interfaces
  count as shared work, like files: the IPC contract
  (`shared/electronApi.ts`, the preload, the `ipcMain` handlers) and the
  database layer. A change that removes or changes them runs alone, or
  after the work that might use them. (#514 removed `getAllBanks` as
  unused while #512, in a parallel batch split by files, started using it.)
- A PR that deletes an API, IPC channel or exported function re-checks its
  callers against current main when it's rebased to merge
  (`git grep <name> origin/main`), not only when it was written.

## Performance budgets

Performance is held in place by budgets in
[`tests/perf/budgets.ts`](../../tests/perf/budgets.ts), checked on every PR.
They pin deterministic work, not wall-clock time:

- IPC calls per user action, by channel
  (`tests/e2e/performance-budgets.e2e.test.ts`, through the main-process
  probe in `tests/perf/ipc-probe.cjs`);
- database connections, SQL statements and synchronous fs calls per
  main-process operation
  (`tests/integration/performance-budgets.integration.test.ts`);
- files written to the card and synchronous fs calls per card write
  (`tests/integration/sync-write-budget.integration.test.ts`, #650).

The factory-scale profile (`tests/validation/performance.validation.ts`) also
checks headroom budgets for returned bytes and main-thread stalls, but only
in the manual validation workflow: timings on shared runners are too noisy
to gate a PR.

How the checks read a budget:

- **`max` is a ratchet.** It's the value measured when the budget was set,
  so a count that goes up fails as a regression. If your change adds work on
  purpose, raise `max` in the same PR and say why in its description.
- **`target` and `until`** record what a planned refactor (see
  [`architecture-review.md`](architecture-review.md)) will bring a count
  down to. `until` names the issue that tracks it (`"#452"`); older budgets
  name a finding from the frozen register (`"RE-36"`). When a count reaches
  its target, the check fails as stale. Set `max` to the new count and
  delete `target` and `until` in the PR that got it there, as with a stale
  `knownBug` marker in the validation harness (which also takes the issue
  number).
- **A measured metric with no budget fails.** A new IPC channel showing up
  in an action gets a budget, or the change gets rethought. `total` is the
  one metric that may go unbudgeted.
- **Lowered a count without a target?** Tighten `max` to the new value, so
  the ratchet holds the gain.

Numbers live in `budgets.ts` and nowhere else: don't copy counts into
Markdown, PR templates or comments. Set `ROMPER_BUDGET_REPORT=<file>` to have
the budget tests append their measurements to that file as JSON lines.

