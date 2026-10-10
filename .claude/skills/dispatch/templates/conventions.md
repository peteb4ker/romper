# Shared rules for Romper subagents

Read this first, then follow it for the whole task. `CLAUDE.md` in the repo
is authoritative; this file adds the working rules the coordinator expects.
If the two disagree, `CLAUDE.md` wins and you say so in your report.

## Worktree and branch

- Create a worktree from the main checkout: from there, run
  `npm run worktree:create <name>`. It makes `../romper-worktrees/<name>`
  (beside the main checkout) on `feature/<name>` from `origin/main`. Work
  there, and don't edit anyone else's worktree.
- **Unique scratch file names.** Subagents of one session share a scratchpad.
  Name anything you write there after your branch or PR (e.g.
  `pr-<branch>-body.md`), never a generic name like `pr.md`, and pass PR
  bodies with `--body-file` from that file only.
- Rename the branch before pushing: `fix/<issue>-<slug>`, or `docs/<slug>`
  or `feat/<slug>` (`git branch -m <new>`).
- The PR title and commits end with the issue number, `(#N)`; the PR
  description ends with `Fixes #N` (`Part of #N` for a partial fix) and says
  which sibling code paths you checked.
- CI runs only on PRs based on `main`. A PR stacked on another branch must
  be retargeted to `main` before CI will run.

## Checks before every push

- `npm run typecheck`, `npm run lint:check` and `npm run test:fast`. Add
  `npm run test:e2e` when you touch `electron/main` or app startup.
- `npm run lint` auto-fixes, and the perfectionist `sort-maps` and
  `sort-sets` rules reorder Map and Set literals. That can change behavior
  where order matters, so review its diff.
- Local npm rewrites `libc` fields in `package-lock.json`. Discard that
  churn (`git checkout -- package-lock.json`) unless the task changes
  dependencies.
- Stage everything you mean to commit; the pre-commit hook needs the index to
  match the working tree. If it fails, fix, stage and commit again.
- Never bypass hooks (`--no-verify`, `-n`, `HUSKY=0`), never use
  `git commit --amend`, never commit on or push to `main`.

## Code and tests

- US English in code, docs and UI text. Docs carry no numbers that code can
  compute (test counts, sizes).
- Tag tests `[UC-NN]` or `[Q-NN]`, e.g. `describe("[UC-14] ...")`.
- In renderer tests, mock IPC with
  `vi.mocked(globalThis.electronAPI.someMethod)`; don't reassign
  `global.window`.
- A UI change ships with regenerated screenshots and matching manual text in
  the same PR (`capture-screenshots` command).
- Don't edit `aidlc-docs/` or the historical list in `BACKLOG.md`. Edit
  `CLAUDE.md` only when the coordinator says the maintainer approved the change.

## Keep the maintainer's data safe

- Never touch the maintainer's real store, their `.romper-dev` settings,
  `~/Library/Application Support/Romper`, any SD card, or
  the `_save/` folder in their Downloads folder.
- Any app launch sets `ROMPER_USER_DATA_DIR` to a temp directory.
- Don't verify UI in a browser (the renderer needs the preload script). Use
  the `run-app` skill.

## Decisions are the maintainer's

UX and behavior choices (wording, shortcuts, defaults, visible behavior) are
not yours. Stop, report the choice with a recommendation, and never ship
wording the maintainer hasn't approved. Don't reopen anything listed under decisions
already made.

## Getting a PR to merged

1. Push and open the PR. Subagents don't turn on PR monitors or Auto-fix.
2. Watch CI. A macOS job cancelled because no runner picked it up is
   rerun with `gh run rerun <id> --failed`; any other failure is yours to
   fix, including one already on `main`.
3. After CI's `analysis` job has run on your latest push, run
   `npm run sonar:pr -- <PR>` and fix new issues (0 is the bar; the quality
   gate alone is not enough).
4. When CI is green and Sonar is at 0, message the shepherd session (look its
   name up with `ListAgents`; currently "💻 PR shepherd 2") asking it to
   ship the PR, and report to the coordinator.
5. Never arm auto-merge and never merge. The shepherd does both.

## Stop and report

Stop and report, rather than push on, when something is unexpected: a
command fails in a way the task didn't predict, the diff grows past the
stated scope, a decision is needed, or the task touches the card write,
migrations, `_save` or a release and you weren't told it would.

## Final report

End with these, in order:

1. **PRs:** URL(s) and head SHA, or "none".
2. **Status:** CI result and Sonar (new issues on the PR).
3. **What changed:** a few lines.
4. **Test evidence:** which tests cover it, and for a fix, that they fail
   without it.
5. **Decisions for the maintainer:** each with your recommendation, or "none".
6. **Left:** anything unfinished, out of scope but noticed, or filed as an
   issue (link it).
7. **Worktree:** its absolute path.
