# Romper -- Claude Code project notes

Cross-platform Electron sample manager for the Squarp Rample Eurorack
sampler. Renderer is React + Tailwind + Vite (`app/renderer`); main and
preload are TypeScript on Node (`electron/`); shared types and the Drizzle
schema live in `shared/`. Database is SQLite via Drizzle ORM on the
synchronous better-sqlite3 driver. Tests are Vitest (unit + integration) and
Playwright (e2e).

## Commands

- `npm run test:fast` -- unit + integration, the suite the pre-commit hook
  runs. One file: `npm run test:unit:fast -- <path>` or
  `npm run test:integration:fast -- <path>` (integration tests run inside
  Electron as Node; don't hand-roll `ELECTRON_RUN_AS_NODE` commands).
- `npm run typecheck`, `npm run lint:check` -- the other pre-commit gates
  (`npm run lint` auto-fixes).
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
  `npm run build` first after changing code.
- `npm run dev` -- builds everything, then runs Vite + Electron. Long-running;
  start it with `run_in_background`. The `run-app` skill covers ports,
  restarts, and screenshotting the live app.
- `npm run build` -- production build of all three layers.

The pre-commit hook runs typecheck, lint, unit + integration tests, and the
build (about 70s). It requires the index to match the working tree, so stage
everything you intend to commit. If it fails, nothing was committed: fix,
stage, and commit again (don't `--amend`).

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
  and runs `npm install`. Remove it with `npm run worktree:remove
  <task-name>` once merged.
- With raw git, always pass the base explicitly:
  `git worktree add <path> -b <branch> origin/main`. Inheriting from a
  non-main HEAD pollutes the PR with someone else's commits (see
  [#270](https://github.com/peteb4ker/romper/pull/270)).
- Merging: see the `ship-pr` skill. Rebase onto `origin/main` and
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
  `⭐💻 RE-03 scoped fs IPC #367`. Keep the feature to a few words and add
  the PR number once a PR exists, e.g. `💻 Scan merge (RE-04) #360`,
  `☁️ Step slicer #354`. Rename the session (`set_session_title`) when you
  start, when you open the PR, and when the scope changes. `ListAgents`
  addresses sessions by title, so look names up again before messaging.
  The main thread turns off its PR monitor's `auto_archive_on_close`, so
  it isn't archived when its PR merges.
- **Backlog:** [`BACKLOG.md`](BACKLOG.md) is the shared status board. Pick
  work from it, claim items with a draft PR titled `... (RE-NN)`, and update
  an item's status in the PR that changes it. Its header has the protocol.
- **Plans:** for work bigger than one PR, commit a spec to
  `docs/developer/<feature>.md` before implementing (like
  `step-sequencer-slicer.md`), and link it from an issue or the PR.
- **Status:** the PR is the status record. Keep its description current
  (done, left, how it was verified) and hand off in PR comments.
- **Findings:** cite IDs from the findings register
  (`aidlc-docs/inception/reverse-engineering/code-quality-assessment.md`)
  and add new ones there.
- **Before starting**, check what's in flight: `gh pr list`,
  `git worktree list`, and `ListAgents` for live local sessions. Don't edit
  another session's worktree or push to its branch; message it or comment on
  its PR.
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
  else is playing on that voice. `claimVoice` in `voiceChoke.ts` enforces it
  at the audio layer for every sound (sequencer, previews, slicer
  auditions); `handlePlay` in `useKitPlayback.ts` also chokes through React
  state, which kit refreshes reset (RE-13).
- **Stereo is a voice setting, not a sample property.** `voices.stereo_mode`
  drives stereo behavior. Never infer it from a file's channel count, and
  never copy samples onto the adjacent voice based on `is_stereo`; that
  created undeletable phantom samples.
- **Renderer code reaches IPC through `globalThis.electronAPI`.** In tests,
  override the default mock (wired up in `vitest.setup.ts`) with
  `vi.mocked(globalThis.electronAPI.someMethod)`; don't reassign
  `global.window`.
- **Voice colors** follow the Rample livery (1 red, 2 yellow, 3 green,
  4 blue) via the `--voice-1..4` tokens in `app/renderer/styles/index.css`.

## Docs

- [`docs/developer/architecture.md`](docs/developer/architecture.md) --
  process split, IPC contracts, sample playback pipeline
- [`docs/developer/coding-guide.md`](docs/developer/coding-guide.md) --
  TypeScript, component, and test conventions
- [`docs/developer/romper-db.md`](docs/developer/romper-db.md) -- schema
- [`docs/developer/product-requirements.md`](docs/developer/product-requirements.md)
  -- users, journeys, and product requirements
- [`docs/developer/release-process.md`](docs/developer/release-process.md)
  and the `release` skill -- tagging and the release workflow
- [`docs/developer/code-signing.md`](docs/developer/code-signing.md) --
  macOS rcodesign config and per-helper entitlements (only a tag-triggered
  release exercises `electron/resources/rcodesign.toml`; PR CI doesn't)
- [`BACKLOG.md`](BACKLOG.md) -- prioritized status of every finding; start
  here when choosing what to work on
- [`aidlc-docs/inception/reverse-engineering/`](aidlc-docs/inception/reverse-engineering/)
  -- AI-DLC reverse-engineering set; `code-quality-assessment.md` is the
  findings register that fix commits cite by ID (`RE-01`...)
- [`docs/troubleshooting.md`](docs/troubleshooting.md) -- user-facing,
  including `ROMPER_ENABLE_DEVTOOLS=1` for inspecting an installed build
