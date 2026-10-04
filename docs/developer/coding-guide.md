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

- A shortcut that must work in the kit browser and elsewhere uses a number
  or a special character only, with no Shift (Pete, #552). Letters are
  reserved for bank jumps in the browser.
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
  `shared/`, but not `__tests__/`. The preload is type-checked by its own
  build (`npm run build:preload`).

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
- Pull requests that touch the app, the e2e specs or how they run
  (`electron/`, `app/`, `shared/`, `tests/e2e/`, `tests/utils/`,
  `tests/validation/support/`, the e2e workflow, the Playwright config,
  `package.json` or the lockfile) run e2e on Linux, macOS and Windows;
  other PRs run Linux only. Pushes to `main` run all three.
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

## Performance budgets

Performance is held in place by budgets in
[`tests/perf/budgets.ts`](../../tests/perf/budgets.ts), checked on every PR.
They pin deterministic work, not wall-clock time:

- IPC calls per user action, by channel
  (`tests/e2e/performance-budgets.e2e.test.ts`, through the main-process
  probe in `tests/perf/ipc-probe.cjs`);
- database connections, SQL statements and synchronous fs calls per
  main-process operation
  (`tests/integration/performance-budgets.integration.test.ts`).

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

