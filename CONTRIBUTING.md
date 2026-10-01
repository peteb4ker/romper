# Contributing to Romper

Thanks for your interest in contributing. This is the short version; the
[developer docs](docs/developer/) have depth.

## Setup

Requires Node.js 22 and npm.

```bash
npm install   # postinstall rebuilds better-sqlite3 for Electron's Node ABI
npm run dev   # builds, then runs Vite + Electron; renderer edits hot-reload
```

Changes under `electron/` (main, preload) need `npm run dev` restarted.
Environment variables are listed under Configuration in the [README](README.md).

## Workflow

1. Branch from `origin/main`. For parallel work,
   `npm run worktree:create <task-name>` creates a worktree on
   `feature/<task-name>` in `../romper-worktrees/<task-name>`, with its own
   dev ports. Once its PR merges, `npm run worktree:remove <task-name>`
   deletes the worktree and its branch, even if you renamed the branch.
2. Commit. The pre-commit hook runs typecheck, lint, unit + integration tests,
   and the build; fix anything it reports rather than bypassing it.
3. Open a PR against `main`. CI runs build, lint, typecheck, unit,
   integration, e2e, and SonarCloud analysis.
4. PRs are rebased onto `main` and merged with the rebase method.

Direct commits and pushes to `main` are blocked.

## Commit messages

Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`,
`chore:`, with an imperative, specific subject under about 72 characters.
Add a body when the why isn't obvious. No co-author or AI attribution
trailers.

## Code

Follow [docs/developer/coding-guide.md](docs/developer/coding-guide.md) and
[docs/developer/architecture.md](docs/developer/architecture.md). New
behavior needs tests; run `npm run test:fast` locally and `npm run test:e2e`
when you touch the main process or app startup.
