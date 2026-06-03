# Romper -- Claude Code project notes

This file gives Claude Code (and any AI assistant reading project context)
the minimum it needs to be useful on the Romper repo. Detailed
documentation lives under `docs/developer/` -- prefer reading those for
anything beyond the high-level orientation below.

## What Romper is

Cross-platform Electron sample manager for the Squarp Rample Eurorack
sampler. Renderer is React + Tailwind + Vite; main + preload are
TypeScript on Node; database is SQLite via Drizzle ORM. Tests are Vitest
(unit + integration) and Playwright (e2e).

## Most-used commands

- `npm run dev` -- builds main/preload/renderer, starts Vite (5173) and
  Electron concurrently. Long-running; run with `run_in_background` or
  in a terminal you can leave open.
- `npm run test:fast` -- unit + integration via Vitest, the same suite
  the pre-commit hook runs.
- `npm run test:e2e` -- Playwright against a packaged build.
- `npm run typecheck` / `npm run lint:check` -- the other pre-commit gates.
- `npm run build` -- production build of all three layers.

## Worktree workflow (required for non-trivial changes)

This repo uses `git worktree` for parallel work so the main checkout
stays clean. Create one before making changes:

```sh
npm run worktree:create <task-name>
cd worktrees/<task-name>
```

The script creates `feature/<task-name>` branched from `origin/main`,
assigns unique dev-server ports, links Claude settings, and runs
`npm install`. To remove a finished worktree use
`npm run worktree:remove`.

## Hard rules

These are non-negotiable; bypassing them costs trust and usually
requires undoing work.

- **Never bypass git hooks.** No `--no-verify`, no `HUSKY=0`. If the
  pre-commit hook fails, fix the underlying problem.
- **Never push directly to `main`.** Work on a branch in a worktree, open
  a PR, let CI run.
- **Always rebase a PR branch onto latest `main` before merging.** Use
  `git rebase origin/main` + `git push --force-with-lease`. Squashing or
  merging via merge-commit is not the default here.
- **Don't dismiss failing CI as "pre-existing".** If the check is red,
  treat it as your problem until proven otherwise.
- **Don't use the `chrome-devtools` MCP tools on this project.** Romper
  is an Electron app, not a webapp; those tools don't apply.

## Canonical docs

When you need real depth, look here before guessing:

- [`README.md`](README.md) -- user-facing overview, env vars, install
- [`CONTRIBUTING.md`](CONTRIBUTING.md) -- contributor-facing summary
- [`docs/developer/architecture.md`](docs/developer/architecture.md) --
  main process / preload / renderer split, IPC contracts, sample
  playback pipeline
- [`docs/developer/coding-guide.md`](docs/developer/coding-guide.md) --
  TypeScript conventions and component patterns
- [`docs/developer/development-workflow.md`](docs/developer/development-workflow.md)
  -- the long-form version of this file
- [`docs/developer/release-process.md`](docs/developer/release-process.md)
  -- tagging, signing, notarization, the GitHub Release workflow
- [`docs/developer/code-signing.md`](docs/developer/code-signing.md) --
  macOS rcodesign config, entitlements, and the per-helper signing
  contract
- [`docs/troubleshooting.md`](docs/troubleshooting.md) -- user-facing
  troubleshooting (e.g. `ROMPER_ENABLE_DEVTOOLS=1` for inspecting an
  installed build)
