---
description: Capture app screenshots for the website and manual documentation. Required after any UI change that shows in a captured view.
argument-hint: "[--all | --target <name>[,<name>...] | --list]  Optionally specify which screenshots to capture"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

Capture screenshots of the Romper app for the website and user manual.

## When to run: every UI change

Any change to what a captured view looks like (layout, controls, labels,
colors) must ship with regenerated screenshots and matching manual text.
This is part of the change, not a follow-up chore:

1. Find the affected targets (`npm run screenshots -- --list`). If a changed
   view has no target, add one.
2. Capture them (see Execution), check every image, and update the manual
   text in `docs/manual/` that describes the changed UI.
3. Put the images and doc edits in the same PR as the UI change. If that PR
   has already merged, raise a `docs/` PR with them straight away; don't
   leave the manual describing the old UI.

This command:

1. Builds the app and launches it with the local Romper instance via Playwright
2. Navigates to each view and captures screenshots
3. Saves them to `docs/images/` (website) and `docs/images/manual/` (manual)
4. Optionally updates the manual markdown files to reference new screenshots

## How It Works

The screenshot targets are defined in `scripts/capture-screenshots.ts` in the `SCREENSHOT_TARGETS` array. Each target specifies:
- `name` -- unique identifier
- `description` -- what the screenshot shows
- `output` -- filename under `docs/images/`
- `navigate()` -- Playwright steps to reach the view
- `selector` (optional) -- CSS selector to crop to a specific element
- `captureOverride()` (optional) -- custom capture logic for advanced screenshots (clip regions, hover effects, etc.)

## Adding New Screenshots

To capture a new feature or UI element:
1. Add a new entry to `SCREENSHOT_TARGETS` in `scripts/capture-screenshots.ts`
2. Define the `navigate()` function using Playwright Page API and `data-testid` selectors
3. Set `selector` if you want to crop to a specific element (omit for full window)
4. Run this command to capture

## Execution

First, list available targets to see what can be captured:

```
npm run screenshots -- --list
```

Then run `npm run screenshots -- <args>` with the user's argument.
`--target` takes one name or a comma-separated list, captured in one build:

```
ROMPER_LOCAL_PATH=<store> ROMPER_HEADLESS=true npm run screenshots -- --target manual-step-sequencer,manual-transport-controls
```

- **`ROMPER_LOCAL_PATH` is required.** The script launches the built app,
  which reads `romper-settings.json` from a different userData folder than
  `npm run dev` does, so without it the app has no store and every kit
  target times out. Use the user's store (find it in
  `~/Library/Application Support/Electron/romper-settings.json`); the
  targets only navigate and open menus, they don't edit kits.
- **`ROMPER_HEADLESS=true`** keeps the window off the user's screen. Hidden
  windows don't draw sample waveforms, so for `manual-voice-panel` (or any
  view with waveforms) run without it.
- The script keeps the committed file when a capture's pixels are
  unchanged (`== ... (unchanged)`), so a PR carries only images that look
  different. Read each changed image before committing.
$ARGUMENTS

If no argument is provided, ask the user whether they want:
- `--all` to capture all screenshots
- `--target <name>` to capture a specific one
- `--list` to see what's available

After capturing, check if manual markdown files need updating to reference new images. For each new screenshot in `docs/images/manual/`, verify it is referenced in the corresponding `docs/manual/*.md` file. If not, suggest where to add it.

## Image References in Manual

Screenshots in the manual use this markdown pattern:
```
![Description of the screenshot]({{ site.baseurl }}/images/manual/filename.png)
```

## Screenshot Specs

Certain screenshots have specific presentation requirements:

- **Bank navigation (`manual-bank-nav`)**: Show only letters A through G (not the full A-Z), with the mouse hovering over D to demonstrate the fisheye magnification effect. Uses `captureOverride` to dispatch a `mousemove` event on the nav element and clip the screenshot to the A-G region.

When adding new screenshots that need hover states, use `captureOverride` with `window.evaluate()` to dispatch synthetic mouse events -- Playwright's native `mouse.move()` does not reliably trigger React synthetic events in Electron.

## Important Notes

- The app must be buildable (`npm run build` must succeed)
- The script uses the local Romper instance (your real local store with actual kits) -- no e2e fixtures
- Romper must have been set up at least once so `romper-settings.json` exists in the Electron userData directory
- Screenshots use a fixed 1280x800 viewport for consistency
- The script resets to the Kit Browser between captures
- If a `data-testid` selector is missing from a component, add it to the React component before capturing
- The kit list renders only what's in view at 1280x800: to reach a kit in a later bank, press its bank letter first (see `manual-step-sequencer-example`)
- The sequencer grid takes keyboard focus when its drawer opens; blur it before capturing (`showSequencer()` in the script) so no focus ring shows
- Toggles inside the sequencer rows are `aria-pressed` too; target step pads with `[role="gridcell"]`
