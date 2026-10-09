---
name: ship-pr
description: Merge discipline for Romper PRs — the author's pre-handover checklist, and the shepherd's loop of running `npm run ship -- <N>` per PR (rebase onto origin/main, typecheck, arm rebase auto-merge, watch it merge) and escalating anything that doesn't merge. Use when handing a PR to the shepherd, merging a PR, draining the PR queue, or a green PR is stuck waiting.
argument-hint: "[pr-number ...]"
---

Merge PR(s) `$ARGUMENTS` following the repo's merge discipline.

## Shepherd: ship the queue

The shepherd's only judgment is **merge or escalate**. The script does the
mechanics; you never fix a PR yourself.

For each PR, **in the order given, one at a time**:

1. **Skip a held PR.** If the PR is labelled `hold` or `do-not-merge`, or
   the coordinator listed it as waiting on Pete's sign-off, don't run
   anything on it. Move to the next PR. (The script refuses those labels
   too, with `result=held`.)
2. Run the script and wait for it to finish (it can take an hour; run it
   with `run_in_background` and wait for it to exit):

   ```sh
   npm run ship -- <N>
   ```

3. Read its **last line**:

   ```
   ship-pr result=<outcome> pr=<N> code=<exit code> detail="<text>"
   ```

   - `result=merged` (code 0): done. Next PR.
   - **Anything else: escalate, don't fix.** Post the line on the PR,
     tell the author session (or the coordinator, if the author is gone),
     then move to the next PR:

     ```sh
     gh pr comment <N> --body "Shepherd stopped: <the result line>. Back to the author."
     ```

     Look the author session up with `ListAgents` (its title has the PR
     number) and `SendMessage` it the same line.

| Outcome | Code | What happened |
| --- | --- | --- |
| `merged` | 0 | Merged (or was already) |
| `dry-run` | 0 | `--dry-run`: all read-only checks passed |
| `error` | 1 | git, gh or npm failed unexpectedly |
| `usage` | 2 | Bad arguments |
| `conflict` | 10 | Rebase onto origin/main conflicts (aborted, nothing pushed) |
| `typecheck` | 11 | Rebased cleanly, but `npm run typecheck` fails |
| `sonar` | 12 | SonarCloud reports new issues (on the latest analysis, or the pushed head's) |
| `frozen` | 13 | Diff touches `aidlc-docs/` or BACKLOG.md's "Fixed before the issue tracker" list |
| `check-failed` | 14 | A CI check failed (lost runners are rerun once first) |
| `not-open` | 15 | Closed, draft, not based on main, or from a fork |
| `held` | 16 | Labelled `hold` or `do-not-merge` |
| `branch-moved` | 17 | Someone pushed the branch while it was shipping |
| `timeout` | 18 | Not merged after 90 polls (about 90 minutes) |

Never, whatever the script says:

- resolve a conflict, edit code, or push to a PR branch yourself;
- merge with `--admin`, merge a held PR, or merge out of the given order;
- use GitHub's "Update branch" button (it adds a merge commit);
- push to `main` or bypass hooks (`--no-verify`, `HUSKY=0`).

### Holding a PR

Two labels keep a PR out of the queue; the shepherd skips them and the
script refuses them:

- `hold`: waiting on Pete's sign-off. Whoever finds an unrecorded decision
  adds it; it comes off once the sign-off is on the issue.
- `do-not-merge`: must not merge as it stands (a spike, or a PR another
  one replaces).

`npm run ship -- <N> --dry-run` runs the read-only checks (state, labels,
frozen paths, SonarCloud, a predicted rebase) and prints the plan without
pushing anything.

### What the script does

It works in a scratch worktree of its own, detached at the PR's head, so it
never touches the author's worktree, and removes it when it exits. It
refuses held, draft and closed PRs and frozen paths, and checks SonarCloud
(`npm run sonar:pr`). It rebases onto origin/main (never resolving a
conflict), runs `npm run typecheck` on the rebased tree (a clean rebase can
still break the build), and pushes with `--force-with-lease` pinned to the
head it started from. The first SonarCloud check reads whatever analysis
exists, often of the pre-rebase head, so it's only an early exit: auto-merge
(rebase) is armed once SonarCloud has analyzed the pushed head and reports 0
new issues, so issues a rebase brings in can't merge unseen. Auto-merge an
author armed earlier is turned off until then. It polls once a minute: a
job no runner ever picked up is rerun once, any other failed check stops
it, BEHIND turns auto-merge off and rebases again by the same rules (the
new head waits for its own analysis), and CLEAN for two polls without
merging (auto-merge fires on a check-completion event, so arming after
everything is green can stall it) merges directly with `--rebase`. When it
stops for any reason but a merge, it turns auto-merge off again.

Branch protection on `main` requires branches to be up to date
(`strict: true`) and the build, lint, typecheck, unit, integration
(ubuntu, windows), e2e-tests-check and analysis checks; `enforce_admins` is
on. After each merge every other open PR is behind, which is why the queue
goes one PR at a time. If `main` goes red after a merge, tell the
coordinator.

## Before handover (the PR author)

Run this before handing a PR to the shepherd, and tick the matching boxes
in the PR description. Each item has sent PRs back after handover (#658).
The shepherd escalates anything the script stops on back to you.

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
   function behind a removed preload method, is fine. The script's
   typecheck after its rebase catches TypeScript callers that land on main
   in the meantime.

6. **The description says `Fixes #N`** for each issue the PR fixes, so
   merging closes it (`Part of #N` for a partial fix). The PR never edits a
   use case's or quality's status in `docs/developer/use-cases.md`: status
   is generated from the open issues, so closing the issue is enough (a
   hand-set supported or partial status fails `npm run trace:check`). The
   Lint job counts the PR's fixed issues as closed and warns if that leaves
   an entry supported with no test above unit level; the check reruns when
   the description is edited. Warnings about issues the PR didn't touch
   aren't the PR's to fix.
7. **Titles and branch name the issue.** The PR title and its commits end
   with the issue number, e.g. `(#552)`, and the branch is
   `fix/<issue>-<slug>`. Don't cite retired `RE-` IDs in new titles or
   branches.
8. **Siblings are checked.** The description says which other callers or
   code paths could have the same bug, and what happened to each: fixed
   here, or filed as an issue (link it). "None found" is an answer; a
   missing check isn't.
9. **Decisions are recorded.** A UX or product choice the PR makes
   (shortcut, wording, behavior) has Pete's sign-off on the issue. If it
   doesn't, label the PR `hold` (`gh pr edit <N> --add-label hold`), say
   so in the description and tell the coordinator. Remove the label once
   Pete signs off.
10. **UI changes carry their screenshots.** If the PR changes how a
    captured view looks, it must include the regenerated screenshots and
    manual text (`capture-screenshots` command).
11. **CI failures are yours** until proven otherwise: no "pre-existing
    failure" dismissals, no `--no-verify`, no `HUSKY=0`. Lockfile
    conflicts on rebase: take your side, then `npm install` to regenerate,
    and confirm overrides and audit state survived.
