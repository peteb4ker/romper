---
name: ship-pr
description: Merge discipline for Romper PRs — rebase onto origin/main, arm auto-merge before CI finishes, rebase-merge method. Use when merging a PR, draining the PR queue, or a green PR is stuck waiting.
argument-hint: "[pr-number ...]"
---

Merge PR(s) `$ARGUMENTS` following the repo's merge discipline.

## The one rule that prevents stuck PRs

**Arm auto-merge immediately after pushing, while CI is still running.**
Auto-merge fires on a check-completion event; arming it after all checks are
already green means no further event arrives and the PR sits forever. If a PR
is already green, skip auto-merge and merge it directly (rebase method).

## Per-PR procedure

1. Rebase the branch onto latest main, never merge-commit it:

   ```sh
   git fetch origin main
   git rebase origin/main
   git push --force-with-lease
   ```

2. Arm auto-merge (rebase method) right away — before CI finishes.
3. **Merge method is rebase**, per the repo hard rules. Not squash, not
   merge-commit.
4. If CI fails, it is your problem until proven otherwise — no "pre-existing
   failure" dismissals, no `--no-verify`, no `HUSKY=0`.

## Queue mechanics (no merge queue on free GitHub)

- Merge serially, oldest-green first. After each merge, the next PR is
  *behind* main; that is fine — "require branches up to date" is
  intentionally off, so a behind-but-conflict-free PR rebase-merges without
  re-running CI.
- The backstop for that gap is post-merge validation on `main` (build /
  typecheck / lint run on every push to main). If main goes red after a
  merge, fix forward immediately; it gates nothing else.
- Only rebase + re-push a queued PR when it actually conflicts; each re-push
  costs a full CI round. Re-arm auto-merge after any re-push.
- Lockfile conflicts on rebase: take your side, then `npm install` to
  regenerate, and confirm overrides/audit state survived.
