# Contributing to Romper

Thanks for your interest in contributing. This is the short version; the
[developer docs](docs/developer/) have depth.

## Setup

Requires Node.js 22 and npm.

```bash
npm ci        # installs exactly what package-lock.json lists
npm run dev   # builds, then runs Vite + Electron; renderer edits hot-reload
```

Changes under `electron/` (main, preload) need `npm run dev` restarted.
`npm run dev` keeps its settings in the checkout's `.romper-dev/user-data`
(ignored by git), starting from a copy of the installed app's settings, so it
never changes the installed app's. Delete that folder to start again.
Environment variables are listed under Configuration in the [README](README.md).

## Workflow

1. Branch from `origin/main`. For parallel work,
   `npm run worktree:create <task-name>` creates a worktree on
   `feature/<task-name>` in `../romper-worktrees/<task-name>`, with its own
   dev ports, and installs dependencies with `npm ci`, so the lockfile stays
   as committed. Once its PR merges, `npm run worktree:remove <task-name>`
   deletes the worktree and its branch, even if you renamed the branch.
2. Commit. The pre-commit hook runs the typecheck, and lints the staged
   files and runs the unit tests related to them; fix anything it reports
   rather than bypassing it. CI runs the full suites and the build.
3. Open a PR against `main`. CI runs build, lint, typecheck, unit,
   integration, e2e, and SonarCloud analysis.
4. PRs are rebased onto `main` and merged with the rebase method, one
   at a time, by `npm run ship -- <N>` (the `ship-pr` skill).

Direct commits and pushes to `main` are blocked.

## Commit messages

Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`,
`chore:`, with an imperative, specific subject under about 72 characters,
ending with the GitHub issue it's for, e.g. `(#537)`. Name the branch
`fix/<issue>-<slug>`, and end the PR description with `Fixes #<issue>`.
Add a body when the why isn't obvious. Attribution trailers, such as
`Co-Authored-By:` for a co-author or an AI assistant, are welcome.

## Code

Follow [docs/developer/coding-guide.md](docs/developer/coding-guide.md) and
[docs/developer/architecture.md](docs/developer/architecture.md). New
behavior needs tests; run `npm run test:fast` locally and `npm run test:e2e`
when you touch the main process or app startup.
