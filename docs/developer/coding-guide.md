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
- Show user-facing errors through `useMessageDisplay`, with a sentence the
  user can act on rather than the raw error.
- Memoize where profiling or list size calls for it. `KitGrid` virtualizes
  with react-window; follow that pattern for any other long list.

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
