---
description: Update main and remove worktrees and branches whose PRs have merged
allowed-tools: Bash, Read
---

Run from the main checkout (`/Users/pete/workspace/romper`, not a worktree).
Worktrees live in `../romper-worktrees/` (from `npm run worktree:create`) and
`.claude/worktrees/` (Claude Code sessions); a few may still be in the legacy
`worktrees/`. `git worktree list` shows them all.

1. `git checkout main && git pull --ff-only origin main && git fetch --prune origin`
2. For each worktree in `git worktree list` (skip the main checkout and any
   worktree with uncommitted changes), and each local branch other than
   `main`, decide whether it is merged:
   - `gh pr list --state merged --head <branch> --json number` returns a PR, or
   - `git cherry origin/main <branch>` prints no `+` lines (every commit is
     already on main — this is what catches rebase merges, which
     `git branch --merged` misses because rebasing rewrites SHAs).
3. Merged: `git worktree remove <path>` then `git branch -D <branch>`.
   Not merged: leave it and report it as active. Never force-remove a worktree
   that has uncommitted changes.
4. `git worktree prune`.

Report a short table of what was removed (with the PR number) and what was
kept, then the current `main` SHA.
