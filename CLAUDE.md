# Romper -- Claude Code project notes

Cross-platform Electron sample manager for the Squarp Rample Eurorack
sampler. Renderer is React + Tailwind + Vite (`app/renderer`); main and
preload are TypeScript on Node (`electron/`); shared types and the Drizzle
schema live in `shared/`. Database is SQLite via Drizzle ORM on the
synchronous better-sqlite3 driver. Tests are Vitest (unit + integration) and
Playwright (e2e).

## Commands

- `npm run test:fast` -- unit + integration, the suite the pre-commit hook
  runs. One file: `npm run test:unit:fast -- <path>` or
  `npm run test:integration:fast -- <path>` (integration tests run inside
  Electron as Node; don't hand-roll `ELECTRON_RUN_AS_NODE` commands).
- `npm run typecheck`, `npm run lint:check` -- the other pre-commit gates
  (`npm run lint` auto-fixes).
- `npm run test:e2e` -- builds, then runs Playwright against the built app.
  Run it when you touch `electron/main` or app startup; unit and integration
  tests can't see startup failures.
- `npm run dev` -- builds everything, then runs Vite + Electron. Long-running;
  start it with `run_in_background`. The `run-app` skill covers ports,
  restarts, and screenshotting the live app.
- `npm run build` -- production build of all three layers.

The pre-commit hook runs typecheck, lint, unit + integration tests, and the
build (about 70s). It requires the index to match the working tree, so stage
everything you intend to commit. If it fails, nothing was committed: fix,
stage, and commit again (don't `--amend`).

## Worktrees and branches

Work happens on a branch in a worktree, rooted at `origin/main`, and lands
through a PR.

- If the session is already in a worktree (for example
  `.claude/worktrees/<name>` on a `claude/*` branch) and
  `git log --oneline origin/main..HEAD` shows only your own commits, work
  there. Don't nest another worktree inside it.
- Otherwise create one with `npm run worktree:create <task-name>`
  (branches `feature/<task-name>` from `origin/main`, writes per-worktree dev
  ports to `.env.local`, links Claude settings, runs `npm install`). Remove
  it with `npm run worktree:remove`.
- With raw git, always pass the base explicitly:
  `git worktree add <path> -b <branch> origin/main`. Inheriting from a
  non-main HEAD pollutes the PR with someone else's commits (see
  [#270](https://github.com/peteb4ker/romper/pull/270)).
- Merging: see the `ship-pr` skill. Rebase onto `origin/main` and
  `git push --force-with-lease`; merge with the rebase method.

## Hard rules

Hooks in `.claude/hooks/` and `.husky/` enforce the first two.

- Never bypass git hooks (`--no-verify`, `-n`, `HUSKY=0`). Fix the failure.
- Never commit on or push to `main`.
- A red CI check is yours to fix until proven otherwise; don't dismiss it as
  pre-existing.
- Don't verify UI in a browser. The renderer needs `globalThis.electronAPI`
  from the preload script, so the Vite URL is broken outside Electron. The
  chrome-devtools MCP server is denied in `.claude/settings.json`; use the
  `run-app` skill instead.

## Invariants that tests won't catch

- **No top-level `await` in `electron/main/index.ts`.** Keep the
  `app.whenReady().then(...)` chain. Top-level await deadlocks the ESM main
  bootstrap and the app never opens a window; only e2e notices. SonarCloud
  S7785 flags this line; it's a won't-fix.
- **Voices are monophonic (voice choke).** Triggering a sample stops whatever
  else is playing on that voice (`handlePlay` in `useKitPlayback.ts`).
- **Stereo is a voice setting, not a sample property.** `voices.stereo_mode`
  drives stereo behavior. Never infer it from a file's channel count, and
  never copy samples onto the adjacent voice based on `is_stereo`; that
  created undeletable phantom samples.
- **Renderer code reaches IPC through `globalThis.electronAPI`.** In tests,
  override the default mock (wired up in `vitest.setup.ts`) with
  `vi.mocked(globalThis.electronAPI.someMethod)`; don't reassign
  `global.window`.
- **Voice colors** follow the Rample livery (1 red, 2 yellow, 3 green,
  4 blue) via the `--voice-1..4` tokens in `app/renderer/styles/index.css`.

## Docs

- [`docs/developer/architecture.md`](docs/developer/architecture.md) --
  process split, IPC contracts, sample playback pipeline
- [`docs/developer/coding-guide.md`](docs/developer/coding-guide.md) --
  TypeScript, component, and test conventions
- [`docs/developer/romper-db.md`](docs/developer/romper-db.md) -- schema
- [`docs/developer/product-requirements.md`](docs/developer/product-requirements.md)
  -- users, journeys, and product requirements
- [`docs/developer/release-process.md`](docs/developer/release-process.md)
  and the `release` skill -- tagging and the release workflow
- [`docs/developer/code-signing.md`](docs/developer/code-signing.md) --
  macOS rcodesign config and per-helper entitlements (only a tag-triggered
  release exercises `electron/resources/rcodesign.toml`; PR CI doesn't)
- [`aidlc-docs/inception/reverse-engineering/`](aidlc-docs/inception/reverse-engineering/)
  -- AI-DLC reverse-engineering set; `code-quality-assessment.md` is the
  findings register that fix commits cite by ID (`RE-01`...)
- [`docs/troubleshooting.md`](docs/troubleshooting.md) -- user-facing,
  including `ROMPER_ENABLE_DEVTOOLS=1` for inspecting an installed build
