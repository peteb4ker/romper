---
description: Check out main, pull latest, and clean up merged worktrees and branches
allowed-tools: Bash, Read
---

Clean up the workspace: switch to main, pull latest, remove merged worktrees and branches.

**NEVER** delete unmerged worktrees or branches — only clean up what's fully merged.

**Squash merge detection**: `git branch --merged` misses squash merges. Use `git diff main <branch> --stat` — empty output means merged.

## Steps

1. **Switch to main and pull**: `git checkout main && git pull origin main`
2. **Prune remotes**: `git fetch --prune origin`
3. **Clean merged worktrees**: Run `git worktree list`, then for each non-main worktree:
   - Check merged: `git branch --merged main | grep <branch>` OR `git diff main <branch> --stat` is empty
   - Merged → `git worktree remove <path>` then `git branch -D <branch>`
   - Unmerged → skip, report as active
4. **Clean merged branches**: `git branch --merged main | grep -v '^\*' | grep -v 'main' | xargs -r git branch -d`
5. **Final prune**: `git worktree prune`

## Summary format

```
## Clean-up Summary

| Action | Item | Status |
|--------|------|--------|
| Removed worktree | `<name>` | merged via PR #N |
| Deleted branch | `<branch>` | merged into main |
| Pruned remotes | N stale refs | cleaned |
| Kept worktree | `<name>` | unmerged (active) |

**Current state:** On `main` at `<sha>`. N worktrees remain.
```
