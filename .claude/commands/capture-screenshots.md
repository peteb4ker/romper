---
description: Capture app screenshots for the website and manual documentation
argument-hint: "[--all | --target <name> | --list]  Optionally specify which screenshots to capture"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

Capture screenshots of the Romper app for the website and user manual. This command:

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
node scripts/capture-screenshots.ts --list
```

Then capture based on the user's argument: $ARGUMENTS

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
