---
name: run-app
description: Launch Romper in dev mode from the current worktree and screenshot or probe the live renderer to verify a UI change. Use when asked to run, start, show, or screenshot the app, or before saying a UI change is done.
---

Romper is an Electron app. The renderer depends on `globalThis.electronAPI`
from the preload script, so opening the Vite URL (`localhost:<port>`) in any
browser (Chrome, the built-in browser pane, chrome-devtools MCP) shows a
broken app. Always verify through Electron.

## Start

1. **Ports.** Each worktree needs its own ports in `.env.local`
   (`VITE_DEV_SERVER_PORT`, `ELECTRON_INSPECT_PORT`, `REMOTE_DEBUG_PORT`).
   `npm run worktree:create` writes it. Desktop-app session worktrees
   (`../romper-worktrees/romper/<name>`) don't get one; create it with
   unused ports (check `lsof -nP -iTCP -sTCP:LISTEN`). Without it,
   `scripts/dev.js` falls back to 5173/9229 and collides with any other
   running instance.
2. **Stop only your own stale instance**, matched by your ports:
   `pkill -f "remote-debugging-port=<REMOTE_DEBUG_PORT>"` and
   `pkill -f "vite dev --config vite.config.ts --port <VITE_DEV_SERVER_PORT>"`.
   Never `pkill -f Electron` — it kills other Electron apps (Claude, VS Code).
3. **Start** `npm run dev` from the worktree with `run_in_background`, and
   leave it running. It builds main + preload + renderer, then starts Vite
   and Electron. Renderer edits hot-reload; changes under `electron/` (main,
   preload) need a restart.
4. **Wait** until `curl -s localhost:<REMOTE_DEBUG_PORT>/json` responds.

## Verify

```sh
node scripts/dev-screenshot.mjs                       # full window -> test-results/dev-screenshot.png
node scripts/dev-screenshot.mjs --selector '[data-testid="kit-grid"]' --out test-results/grid.png
node scripts/dev-screenshot.mjs --eval "location.hash"   # prints the JSON result, then screenshots
```

Read the PNG to check the change. The app uses your real local store
(`romper-settings.json` in Electron userData), so what you see is the user's
actual kits.

To click or type before capturing, use `--eval` with DOM calls, dispatching
events on the element; Playwright's `mouse.move()` does not reliably trigger
React handlers in Electron.

To try edits (steps, slices, settings) without touching the user's kits,
copy their store and start dev with `ROMPER_LOCAL_PATH=<copy> npm run dev`;
the app shows a "Test Mode" banner.

When you're done, stop the instance (step 2) unless the user wants it left
open.

A UI change isn't done until the manual matches it: regenerate the affected
screenshots and update the manual text (the `capture-screenshots` command),
in the same PR or, if it has merged, a `docs/` PR right away.
