---
name: ship-pr
description: Merge discipline for Romper PRs — the author's pre-handover checklist, rebase onto origin/main, arm auto-merge before CI finishes, rebase-merge method. Use when handing a PR to the shepherd, merging a PR, draining the PR queue, or a green PR is stuck waiting.
argument-hint: "[pr-number ...]"
---

Merge PR(s) `$ARGUMENTS` following the repo's merge discipline.

## The one rule that prevents stuck PRs

**Arm auto-merge immediately after pushing, while CI is still running.**
Auto-merge fires on a check-completion event; arming it after all checks are
already green means no further event arrives and the PR sits forever. If a PR
is already green, skip auto-merge and merge it directly (rebase method).

## Before handover (the PR author)

Run this before handing a PR to the shepherd, and tick the matching boxes
in the PR description. Each item has sent PRs back after handover (#658).

1. **Rebased on current origin/main**, and the push's CI is the one you
   check below:

   ```sh
   git fetch origin main && git rebase origin/main && git push --force-with-lease
   ```

2. **Typecheck passes** with both configs (app and tests):
   `npm run typecheck`.
3. **End-to-end passes** if the PR touches `electron/main`, app startup or
   the write path (writing kits to the card): `npm run test:e2e`. Unit and
   integration tests can't see a startup failure.
4. **SonarCloud shows 0 new issues** on the PR, not just a passing quality
   gate (the gate lets new code smells through). After CI's `analysis` job
   has run on your latest push:

   ```sh
   npm run sonar:pr -- <N>
   ```

   It exits 0 for no open issues, 1 with each issue listed, and 2 if
   SonarCloud hasn't analyzed the head commit yet. By hand:
   `curl -s "https://sonarcloud.io/api/issues/search?componentKeys=peteb4ker_romper&pullRequest=<N>&resolved=false" | jq .total`.

5. **Nothing the PR removes is still used.** After the rebase, list the
   exports, `ElectronAPI` members and IPC channels the diff removes (and
   doesn't re-add elsewhere), and grep the rebased tree for each:

   ```sh
   removed() {  # names one side of the diff defines; $1 is - or '\+'
     git diff -U0 origin/main...HEAD -- '*.ts' '*.tsx' '*.js' '*.mjs' | sed -nE \
       -e "s/^$1[[:space:]]*export (default )?(async )?(function|const|let|class|interface|type|enum) ([A-Za-z0-9_]+).*/\4/p" \
       -e "s/^$1  ([A-Za-z0-9_]+)\??: .*/\1/p" \
       -e "s/^$1.*(invoke|handle|on)\(\"([^\"]+)\".*/\2/p" \
       -e "s/^$1[[:space:]]+\"([a-z0-9]+(-[a-z0-9]+)+)\",?\$/\1/p" | sort -u
   }
   comm -23 <(removed -) <(removed '\+') | while read -r name; do
     git grep -nwF "$name" -- . ':!*.md' ':!*__tests__*' ':!tests/*'
   done
   ```

   No output means nothing outside tests and docs still names them. Read
   each hit: a caller (like `globalThis.electronAPI.getAllBanks` in #514)
   blocks handover. A same-named function elsewhere, such as main's DB
   function behind a removed preload method, is fine.

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
   when it was written. Another PR may have started using it since. The
   grep in "Before handover" lists them.
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
  integration-tests on ubuntu and windows, e2e-tests-check and analysis.
  Pull requests don't run macOS integration or e2e, so neither is
  required; `main` pushes and releases run them (#698, #745).
  `enforce_admins` is on, so `--admin` can't skip them. After each merge,
  every other open PR is *behind* and can't merge until it is rebased.
- Merge serially, oldest-green first. For the next PR: rebase onto
  `origin/main`, `git push --force-with-lease`, re-arm auto-merge
  immediately, and let it merge when CI goes green.
- If `main` goes red after a merge, fix forward immediately.
- Lockfile conflicts on rebase: take your side, then `npm install` to
  regenerate, and confirm overrides/audit state survived.
