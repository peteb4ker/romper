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

The script fetches `origin`, then creates `feature/<task-name>` branched
from `origin/main`, assigns unique dev-server ports, links Claude
settings, and runs `npm install`. To remove a finished worktree use
`npm run worktree:remove`.

**All new branches must be rooted at `origin/main`.** This is not a
preference -- mis-rooting silently pollutes PR diffs with whichever
commits live on the parent branch but not yet on main (see
[#270](https://github.com/peteb4ker/romper/pull/270) for the incident
that motivated the script fix). Concretely:

- Prefer `npm run worktree:create` -- it does the right thing for you.
- If you must use raw git (e.g. Claude Code's own `Agent` tool's
  worktree isolation, or a manual `git worktree add`), pass
  `origin/main` as the explicit base:

  ```sh
  git fetch origin --quiet
  git worktree add <path> -b <branch> origin/main
  ```

- Before opening a PR, sanity-check the branch base:

  ```sh
  git log --oneline origin/main..HEAD
  ```

  If anything beyond your intended commits shows up, rebase onto
  `origin/main` with `git rebase --onto origin/main <orphan-commit>`
  before pushing.

- Claude Code sessions sometimes start in a worktree that's already
  checked out on a non-main branch. That's harmless for inspection,
  but never run `git worktree add` *without* an explicit base from
  inside such a session -- inherit-from-HEAD is exactly the trap
  this directive is here to prevent.

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
