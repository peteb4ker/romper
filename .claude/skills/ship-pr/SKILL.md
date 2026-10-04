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
5. **The description says `Fixes #N`** for each issue the PR fixes, so
   merging closes it (`Part of #N` for a partial fix). The PR never edits a
   use case's or quality's status in `docs/developer/use-cases.md`: status
   is generated from the open issues, so closing the issue is enough (a
   hand-set supported or partial status fails `npm run trace:check`). The
   Lint job counts the PR's fixed issues as closed and warns if that leaves
   an entry supported with no test above unit level; the check reruns when
   the description is edited. Warnings about issues the PR didn't touch
   aren't the PR's to fix.
6. **Titles and branch name the issue.** The PR title and its commits end
   with the issue number, e.g. `(#552)`, and the branch is
   `fix/<issue>-<slug>`. Don't cite retired `RE-` IDs in new titles or
   branches.
7. **Siblings are checked.** The description says which other callers or
   code paths could have the same bug, and what happened to each: fixed
   here, or filed as an issue (link it). "None found" is an answer; a
   missing check isn't.
8. **Removals are re-checked at merge time.** If the PR deletes an API,
   IPC channel or exported function, re-check its callers on current main
   after the rebase in step 1 (`git grep <name> origin/main`), not only
   when it was written. Another PR may have started using it since.
9. **Decisions are recorded.** A UX or product choice the PR makes
   (shortcut, wording, behaviour) has Pete's sign-off on the issue. If it
   doesn't, stop and ask the coordinator before merging.
10. **UI changes carry their screenshots.** If the PR changes how a
    captured view looks, it must include the regenerated screenshots and
    manual text (`capture-screenshots` command). If it merged without
    them, raise a `docs/` PR with them before moving on.

## Queue mechanics (no merge queue on free GitHub)

- Branch protection on `main` requires branches to be up to date
  (`strict: true`) and these checks: build, lint, typecheck, unit-tests,
  integration-tests on ubuntu, windows and macos, and e2e-tests-check.
  `enforce_admins` is on, so `--admin` can't skip them. After each merge,
  every other open PR is *behind* and can't merge until it is rebased.
- Merge serially, oldest-green first. For the next PR: rebase onto
  `origin/main`, `git push --force-with-lease`, re-arm auto-merge
  immediately, and let it merge when CI goes green.
- If `main` goes red after a merge, fix forward immediately.
- Lockfile conflicts on rebase: take your side, then `npm install` to
  regenerate, and confirm overrides/audit state survived.
