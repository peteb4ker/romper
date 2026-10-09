# Romper -- Claude Code project notes

Cross-platform Electron sample manager for the Squarp Rample Eurorack
sampler. Renderer is React + Tailwind + Vite (`app/renderer`); main and
preload are TypeScript on Node (`electron/`); shared types and the Drizzle
schema live in `shared/`. Database is SQLite via Drizzle ORM on the
synchronous better-sqlite3 driver. Tests are Vitest (unit + integration) and
Playwright (e2e).

## Commands

- `npm run test:fast` -- the full unit + integration suites, as CI runs
  them (the pre-commit hook runs only the unit tests related to the staged
  files). One file: `npm run test:unit:fast -- <path>` or
  `npm run test:integration:fast -- <path>` (integration tests run inside
  Electron as Node; don't hand-roll `ELECTRON_RUN_AS_NODE` commands).
  The fast configs size their workers to the free cores, so a busy machine
  runs fewer instead of timing out; `ROMPER_TEST_WORKERS=<n>` overrides.
- `npm run typecheck` (both configs; the pre-commit hook runs it) and
  `npm run lint:check` (the whole repo, as CI does; `npm run lint`
  auto-fixes).
- `npm run test:e2e` -- builds, then runs Playwright against the built app.
  Run it when you touch `electron/main` or app startup; unit and integration
  tests can't see startup failures. The window stays hidden
  (`ROMPER_HEADLESS=true`) and settings go to a temp folder
  (`ROMPER_USER_DATA_DIR`), both set in `playwright.config.ts`, so it's safe
  to run while the user is working; `npm run test:e2e:headed` shows it. A
  script that launches the app itself must set `ROMPER_USER_DATA_DIR` too, or
  it overwrites the installed app's settings. To rerun
  one spec against an existing build, use
  `npm run test:play -- tests/e2e/<file>`. It doesn't rebuild, so run
  `npm run build` first after changing code. The e2e error guard fails a
  test on any main-process stderr line except known noise from Chromium,
  the OS or the harness, listed in `tests/validation/support/known-noise.ts`.
  If a run fails on such a line, add or widen its source's entry there,
  with its platforms, a reason (required), a link where there is one, and
  the real line as an example; don't expect it in one spec. See "Known
  noise" in the coding guide. CI runs e2e on Linux only for PRs; pushes
  to `main` and releases run it on macOS and Windows too, so a macOS- or
  Windows-only failure first shows up on `main`.
- `npm run dev` -- builds everything, then runs Vite + Electron. Long-running;
  start it with `run_in_background`. Its settings live in the worktree's
  `.romper-dev/user-data`, seeded from the installed app's on first run, so
  it never changes the installed app's settings. The `run-app` skill covers
  ports, restarts, and screenshotting the live app.
- `npm run build` -- production build of all three layers.

The pre-commit hook runs the typecheck and, on the staged files only
(`lint-staged.config.mjs`), ESLint with `--fix` and the unit tests related
to them (`vitest related`). The full lint, unit and integration suites and
the build run in CI only; run `npm run test:fast` or `npm run build`
yourself when a change reaches beyond the files it touches. The hook
requires the index to match the working tree, so stage everything you
intend to commit. If it fails, nothing was committed: fix, stage, and
commit again (don't `--amend`).

## Worktrees and branches

Work happens on a branch in a worktree, rooted at `origin/main`, and lands
through a PR.

- If the session is already in a worktree on a `claude/*` branch and
  `git log --oneline origin/main..HEAD` shows only your own commits, work
  there. Don't nest another worktree inside it. Desktop-app sessions land in
  `../romper-worktrees/romper/<name>`, or in `.claude/worktrees/<name>` if
  the app's "Worktree location" setting is unset. Cloud sessions work in
  their own clone, on the branch they were given.
- Otherwise create one with `npm run worktree:create <task-name>`. It
  branches `feature/<task-name>` from `origin/main` in
  `../romper-worktrees/<task-name>` (beside the main checkout, not inside
  it), writes per-worktree dev ports to `.env.local`, links Claude settings,
  and runs `npm ci`, which installs from the lockfile without rewriting
  it. Once merged, remove it with `npm run worktree:remove <task-name>`.
  That finds the worktree by its folder name, so it still works after you
  rename the branch (e.g. to `fix/...`), and deletes whatever branch it's
  on.
- With raw git, always pass the base explicitly:
  `git worktree add <path> -b <branch> origin/main`. Inheriting from a
  non-main HEAD pollutes the PR with someone else's commits (see
  [#270](https://github.com/peteb4ker/romper/pull/270)).
- Merging: see the `ship-pr` skill; the shepherd runs
  `npm run ship -- <N>`. Rebase onto `origin/main` and
  `git push --force-with-lease`; merge with the rebase method. Don't use
  GitHub's "Update branch" button: it adds a merge commit.

## Working alongside other sessions

Several Claude sessions work on this repo at once, some in the desktop app
and some in the cloud. A cloud session sees only what's pushed: not personal
memory in `~/.claude`, `.claude/settings.local.json`, `.env.local`, or
anything said in another session. Anything another session needs goes in
the repo or on GitHub.

- **Session names:** `💻 <feature> #<PR>` for a local session (desktop
  app or CLI on this machine), `☁️ <feature> #<PR>` for a cloud session. The
  project's main (coordinating) thread puts ⭐ in front:
  `⭐💻 Scoped fs IPC #367`. Keep the feature to a few words and add
  the PR number once a PR exists, e.g. `💻 Scan merge #360`,
  `☁️ Step slicer #354`. Rename the session (`set_session_title`) when you
  start, when you open the PR, and when the scope changes. `ListAgents`
  addresses sessions by title, so look names up again before messaging.
  The main thread turns off its PR monitor's `auto_archive_on_close`, so
  it isn't archived when its PR merges.
- **Backlog:** GitHub issues are the backlog; [`BACKLOG.md`](BACKLOG.md)
  has the protocol. Each issue is labelled with the use case or quality
  (`UC-NN`, `Q-NN` in `docs/developer/use-cases.md`) where a user would
  notice it, a kind and a severity. The loop:
  1. Triage first: `gh issue list --label triage` (and unlabelled issues).
     Give each a UC/Q label, a kind and a severity, and remove `triage`.
  2. Pick: `gh issue list --label severity:high`, then medium, then by use
     case (`--label UC-19`); skip claimed ones.
  3. Claim: a draft PR whose description says `Fixes #N`, or a comment on
     the issue. Branch `fix/<issue>-<slug>`; commit and PR titles end with
     the issue number, e.g. `(#552)`.
  4. Fix it, with tests tagged `[UC-NN]` or `[Q-NN]`, and look for
     siblings: other callers or code paths with the same bug. Fix them or
     file issues, and list them in the PR.
  5. The PR body ends with `Fixes #N`. Merging closes the issue, and the
     release notes list the closed issues.
  6. A new finding becomes an issue: a plain title saying what a user
     would notice, a UC/Q, kind and severity label, and the technical
     detail in the body.

  Status is generated, never edited: an entry is supported when no open
  issue carries its label and partial when one does (only `**Status:** not
  built` is written by hand). Fix PRs never touch a status; closing the
  issue is enough. `npm run trace` prints the statuses, and the Lint job
  summary shows them. `npm run trace:check` warns on a PR about what a
  release can't ship with (an issue or entry without its label, a
  supported entry with no test above unit level and no declared gap; fix
  the warning if your PR caused it), and the release fails on it
  (`--strict-issues`).
- **Plans:** for work bigger than one PR, commit a spec to
  `docs/developer/<feature>.md` before implementing (like
  `step-sequencer-slicer.md`), and link it from an issue or the PR.
- **Status:** the PR is the status record. Keep its description current
  (done, left, how it was verified) and hand off in PR comments.
- **Product decisions** (shortcuts, wording, behaviour choices) need
  Pete's sign-off recorded on the issue before you build them. Don't pick
  one yourself: if the issue has no recorded decision, ask the coordinator.
- **Describe only what's on main.** Re-check `origin/main` before filing
  or editing an issue; never describe code that exists only in an open PR.
  Cite symbols (`claimVoice` in `voiceChoke.ts`), not line numbers.
- **`RE-` IDs are retired.** GitHub issues are the only record of open work
  and new findings. The findings register
  (`aidlc-docs/inception/reverse-engineering/code-quality-assessment.md`)
  is a frozen, dated snapshot: don't add findings or "Fixed in #N" notes to
  it, or cite `RE-` IDs in new commits, titles or branches. `RE-` IDs in
  older commits, issues, code comments and docs refer to the snapshot;
  leave them as they are.
- **Before starting**, check what's in flight: `gh pr list`,
  `git worktree list`, and `ListAgents` for live local sessions. Don't edit
  another session's worktree or push to its branch; message it or comment on
  its PR.
- **Shared interfaces are shared work.** When splitting work across
  sessions or agents, treat the IPC contract (`shared/electronApi.ts`,
  preload, `ipcMain` handlers) and the database layer like shared files: a
  change that removes or changes them runs alone, or after the work that
  might use them. See the coding guide.
- **Messages:** `SendMessage` reaches local, Remote Control, and cloud
  sessions, but cloud sessions can't reply, so their results come back
  through the PR. To wait on a local session, use `notify_when_idle` rather
  than polling.
- **Auto-fix:** right after opening a PR from a desktop-app session, turn
  on its Auto-fix (`set_monitor` with `auto_fix: true`; bind the PR first
  with `bind_pr` if `get_status` doesn't show it). Don't ask first. The app
  then wakes the session on CI failures, merge conflicts and review
  comments, so nobody polls CI.
- **Unattended PRs:** cloud sessions don't have Auto-fix. A routine
  (`/schedule`) can re-check a cloud-owned PR's CI and act on failures
  until it merges.

## Hard rules

Hooks in `.claude/hooks/` and `.husky/` enforce the first two.

- Never bypass git hooks (`--no-verify`, `-n`, `HUSKY=0`). Fix the failure.
- Never commit on or push to `main`.
- A red CI check is yours to fix, including failures already on main that
  someone else caused; nobody else will fix them. Check whether a failure
  is also on main (`gh run list --commit <sha>` along main's history), fix
  it in its own `fix/` PR, and tell any live session that owns the code.
- A UI change ships with regenerated manual and website screenshots and
  matching manual text, in the same PR; if it already merged, raise a
  `docs/` PR right away. See the `capture-screenshots` command.
- Docs don't carry numbers that code can compute (test counts, call
  counts, sizes). Generate them at check or build time, or pin them in a
  test (performance budgets live in `tests/perf/budgets.ts`). Committed
  counts go stale on every PR and are easy to get wrong.
- Claims about how the Rample behaves need a source: quote the
  [Rample manual](https://squarp.net/rample/manual/), or mark the claim
  "unverified on hardware". This covers code comments, docs and issues.
- Don't verify UI in a browser. The renderer needs `globalThis.electronAPI`
  from the preload script, so the Vite URL is broken outside Electron. The
  chrome-devtools MCP server is denied in `.claude/settings.json`; use the
  `run-app` skill instead.

## Invariants that tests won't catch

- **No top-level `await` in `electron/main/index.ts`.** Keep the
  `app.whenReady().then(...)` chain. Top-level await deadlocks the ESM main
  bootstrap and the app never opens a window; only e2e notices. SonarCloud
  S7785 flags this line; it's a won't-fix.
- **Voices are monophonic (voice choke).** Triggering a sample stops whatever
  else is playing on that voice. This is Romper's design; the manual
  doesn't describe a choke, so whether the Rample does it is unverified on
  hardware. `claimVoice` in `voiceChoke.ts` enforces it at the audio layer
  for every sound (sequencer, previews, slicer auditions).
- **Stereo is a voice setting, not a sample property.** This is Romper's
  design, chosen to stop phantom samples, not Rample behaviour. The manual
  says only "A stereo sample will fill 2 mono voices." and "All layers
  must be of the same type (mono OR stereo) in a voice." In Romper,
  `voices.stereo_mode` drives stereo; samples have no stereo flag. Never
  copy samples onto the adjacent voice because a file is stereo; that
  created undeletable phantom samples. Don't infer a voice's setting from
  a file's channel count, except as Pete's "Final stereo rules v2" on
  #537 decide (in the Stereo section of `docs/developer/domain-model.md`):
  a mono voice is always fine and is mixed down at write; setup and the
  write link a voice automatically when every sample on it is stereo and
  the next voice is free, unless the user chose mono
  (`voices.stereo_choice`); Romper never unlinks; a kit that breaks a
  stereo pair, or holds a WAV Romper can't read, is quarantined: not
  written, its card folder untouched; a scan changes nothing and reports.
  The rules and their words live in `shared/stereoLinkRules.ts`, shared by
  main, setup, scan, the write, the link button and drops. Use "stereo
  pair", "link", "unlink", "mixed down to mono" and "quarantined", never
  "busy" or "in use"; new wording needs Pete's sign-off.
- **Renderer code reaches IPC through `globalThis.electronAPI`.** In tests,
  override the default mock (wired up in `vitest.setup.ts`) with
  `vi.mocked(globalThis.electronAPI.someMethod)`; don't reassign
  `global.window`.
- **Voice colors** are 1 red, 2 yellow, 3 green, 4 blue, via the
  `--voice-1..4` tokens in `app/renderer/styles/index.css`. They're meant
  to match the module; that's unverified on hardware (the manual doesn't
  give voice colors).

## Docs

- [`docs/developer/architecture.md`](docs/developer/architecture.md) --
  process split, IPC contracts, sample playback pipeline
- [`docs/developer/coding-guide.md`](docs/developer/coding-guide.md) --
  TypeScript, component, and test conventions
- [`docs/developer/romper-db.md`](docs/developer/romper-db.md) -- schema
- [`docs/developer/domain-model.md`](docs/developer/domain-model.md) -- one
  owner per concept (kit, voice, sample, bank, store), with links to the
  Rample manual and the use cases
- [`docs/developer/product-requirements.md`](docs/developer/product-requirements.md)
  -- users, journeys, and product requirements
- [`docs/developer/use-cases.md`](docs/developer/use-cases.md) -- the use
  case and quality register (UC-01..., Q-01...): descriptions and entry
  points; open issues are the GitHub issues labelled with the ID, and they
  set each entry's status. Tag tests with the use cases they cover
  (`describe("[UC-14] ...")`)
- `docs/developer/traceability.md` -- each use case's generated status and
  its use case × test layer matrix, generated by `npm run trace` and not
  committed; CI's Lint job shows it in its summary
- [`docs/developer/release-process.md`](docs/developer/release-process.md)
  and the `release` skill -- tagging and the release workflow
- [`docs/developer/code-signing.md`](docs/developer/code-signing.md) --
  macOS rcodesign config and per-helper entitlements (only a tag-triggered
  release exercises `electron/resources/rcodesign.toml`; PR CI doesn't)
- [`BACKLOG.md`](BACKLOG.md) -- how to pick, claim, fix and report GitHub
  issues, and the findings fixed before the issue tracker
- [`aidlc-docs/inception/reverse-engineering/`](aidlc-docs/inception/reverse-engineering/)
  -- AI-DLC reverse-engineering set, a frozen snapshot of commit `87bea51`;
  `code-quality-assessment.md` is the findings register that older `RE-`
  IDs refer to. Current status is in GitHub issues and the code.
- [`docs/troubleshooting.md`](docs/troubleshooting.md) -- user-facing,
  including `ROMPER_ENABLE_DEVTOOLS=1` for inspecting an installed build
