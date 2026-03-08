/**
 * Screenshot Capture Script for Romper Documentation
 *
 * Launches the Electron app using the local Romper instance (your real
 * local store with actual kits) and captures screenshots of specified
 * views/elements for use in the website and manual.
 *
 * Prerequisites:
 *   - A configured Romper local store with kits (the app must have been
 *     set up at least once so romper-settings.json exists)
 *
 * Usage:
 *   npx tsx scripts/capture-screenshots.ts [--target <name>] [--all] [--list]
 *
 * Targets are defined in SCREENSHOT_TARGETS below. New targets can be added
 * by appending to that array -- each target specifies a name, the navigation
 * steps to reach the view, an optional element selector to crop to, and the
 * output path under docs/images/.
 *
 * Examples:
 *   npx tsx scripts/capture-screenshots.ts --all          # capture everything
 *   npx tsx scripts/capture-screenshots.ts --target kit-browser
 *   npx tsx scripts/capture-screenshots.ts --target kit-details
 *   npx tsx scripts/capture-screenshots.ts --list          # print available targets
 */

import path from "path";
import { _electron as electron } from "playwright";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS_IMAGES = path.join(ROOT, "docs", "images");

// ---------------------------------------------------------------------------
// Screenshot Target Definitions
//
// To add a new screenshot:
//   1. Add an entry to this array
//   2. Define the navigate() function to get the app into the right state
//   3. Optionally set `selector` to crop to a specific element
//   4. Set `output` to the filename under docs/images/
//
// The navigate() function receives the Playwright Page (window) object.
// The app starts on the Kit Browser view with fixtures loaded.
// ---------------------------------------------------------------------------

const SCREENSHOT_TARGETS = [
  // -- Website front page screenshots --
  {
    description:
      "Kit Browser - full window (website hero + screenshots section)",
    name: "app-screenshot",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      // Scroll to top to ensure full browser view
      await window.evaluate(() => window.scrollTo(0, 0));
      await window.waitForTimeout(500);
    },
    output: "app-screenshot.png",
  },
  {
    description: "Kit Details view - full window (website screenshots section)",
    name: "kit-details",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      // Click the first kit to open details
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-details"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(500);
    },
    output: "kit-details.png",
  },

  // -- Manual inline screenshots --
  {
    description: "Kit Browser header bar with search, filters, and actions",
    name: "manual-kit-browser-header",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(300);
    },
    output: "manual/kit-browser-header.png",
    selector: '[data-testid="kit-browser-header"]',
  },
  {
    description: "Single kit card showing voice counts, name, and status",
    name: "manual-kit-card",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(300);
    },
    output: "manual/kit-card.png",
    selector: '[data-testid^="kit-item-"]:first-of-type',
  },
  {
    captureOverride: async (window, outputPath) => {
      const nav = window.locator('[data-testid="bank-nav"]');
      const navBox = await nav.boundingBox();
      if (!navBox) throw new Error("bank-nav not visible");
      // Trigger fisheye by dispatching a mousemove event on the nav element
      // positioned at the D button (index 3). Playwright mouse events don't
      // always trigger React synthetic events in Electron, so we dispatch directly.
      await window.evaluate(() => {
        const nav = document.querySelector('[data-testid="bank-nav"]');
        if (!nav) return;
        const rect = nav.getBoundingClientRect();
        // D is the 4th letter (index 3), so position at ~3.5/26 of the nav height
        const targetY = rect.top + (3.5 / 26) * rect.height;
        const targetX = rect.left + rect.width / 2;
        nav.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: targetX,
            clientY: targetY,
          }),
        );
      });
      await window.waitForTimeout(300);
      // Get G button position (may have shifted due to fisheye)
      const bankG = window.locator(
        '[data-testid="bank-nav"] button:nth-child(7)',
      );
      const gBox = await bankG.boundingBox();
      if (!gBox) throw new Error("bank G button not visible");
      // Clip from top of nav to bottom of G button, 20% wider to show fisheye
      const clipWidth = navBox.width * 1.2 + 8;
      await window.screenshot({
        clip: {
          height: gBox.y + gBox.height - navBox.y + 4,
          width: clipWidth,
          x: navBox.x,
          y: navBox.y,
        },
        path: outputPath,
      });
    },
    description: "Bank navigation bar (A-G) with fisheye hover on D",
    name: "manual-bank-nav",
    // Custom capture: hover D to trigger fisheye, then clip to A-G only
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(300);
    },
    output: "manual/bank-nav.png",
  },
  {
    description: "Kit Details header with navigation, name, lock, favorite",
    name: "manual-kit-details-header",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-details"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(300);
    },
    output: "manual/kit-details-header.png",
    selector: '[data-testid="kit-header"]',
  },
  {
    description: "Single voice panel showing sample slots and waveforms",
    name: "manual-voice-panel",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-details"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(500);
    },
    output: "manual/voice-panel.png",
    selector: '[data-testid="voice-panel-1"]',
  },
  {
    description: "Step sequencer grid with transport controls",
    name: "manual-step-sequencer",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-details"]', {
        timeout: 10000,
      });
      // Show the sequencer
      const showBtn = window.locator(
        '[data-testid="kit-step-sequencer-handle"]',
      );
      if (await showBtn.isVisible()) {
        await showBtn.click();
        await window.waitForTimeout(500);
      }
    },
    output: "manual/step-sequencer.png",
    selector: '[data-testid="kit-step-sequencer"]',
  },
  {
    captureOverride: async (window, outputPath) => {
      // Right-click on the first active step to show the condition popover
      // First find any active step (velocity > 0)
      const activeStep = window.locator('button[aria-pressed="true"]').first();
      if (await activeStep.isVisible({ timeout: 3000 }).catch(() => false)) {
        await activeStep.click({ button: "right" });
      } else {
        // Fallback: right-click step 0-0 even if inactive
        const step = window.locator('[data-testid="seq-step-0-0"]');
        await step.click({ button: "right" });
      }
      await window.waitForTimeout(300);

      // Wait for the condition popover to appear
      const popover = window.locator('[data-testid="condition-popover"]');
      await popover.waitFor({ state: "visible", timeout: 3000 });
      await popover.screenshot({ path: outputPath });
    },
    description:
      "Trigger condition popover showing A:B options (right-click menu)",
    name: "manual-condition-popover",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-details"]', {
        timeout: 10000,
      });
      // Show the sequencer
      const showBtn = window.locator(
        '[data-testid="kit-step-sequencer-handle"]',
      );
      if (await showBtn.isVisible()) {
        await showBtn.click();
        await window.waitForTimeout(500);
      }
    },
    output: "manual/condition-popover.png",
  },
  {
    captureOverride: async (window, outputPath) => {
      // Capture the right-side controls area of voice row 0 (sample mode + mute + volume)
      const sampleMode = window.locator('[data-testid="sample-mode-0"]');
      const volumeSlider = window.locator('[data-testid="voice-volume-0"]');
      await sampleMode.waitFor({ state: "visible", timeout: 3000 });
      await volumeSlider.waitFor({ state: "visible", timeout: 3000 });

      const modeBox = await sampleMode.boundingBox();
      const volBox = await volumeSlider.boundingBox();
      if (!modeBox || !volBox) throw new Error("Controls not visible");

      // Clip from sample mode button to end of volume slider with padding
      const pad = 4;
      const x = modeBox.x - pad;
      const y = modeBox.y - pad;
      const width = volBox.x + volBox.width - modeBox.x + pad * 2;
      const height = Math.max(modeBox.height, volBox.height) + pad * 2;

      await window.screenshot({
        clip: { height, width, x, y },
        path: outputPath,
      });
    },
    description: "Voice controls: sample mode, mute toggle, volume slider",
    name: "manual-voice-controls",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-details"]', {
        timeout: 10000,
      });
      // Show the sequencer
      const showBtn = window.locator(
        '[data-testid="kit-step-sequencer-handle"]',
      );
      if (await showBtn.isVisible()) {
        await showBtn.click();
        await window.waitForTimeout(500);
      }
    },
    output: "manual/voice-controls.png",
  },
  {
    captureOverride: async (window, outputPath) => {
      // Capture the transport controls (play button + BPM + cycle counter area)
      const controls = window.locator(
        '[data-testid="kit-step-sequencer-controls"]',
      );
      await controls.waitFor({ state: "visible", timeout: 3000 });
      await controls.screenshot({ path: outputPath });
    },
    description: "Sequencer transport controls: play/stop, BPM, cycle counter",
    name: "manual-transport-controls",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-details"]', {
        timeout: 10000,
      });
      // Show the sequencer
      const showBtn = window.locator(
        '[data-testid="kit-step-sequencer-handle"]',
      );
      if (await showBtn.isVisible()) {
        await showBtn.click();
        await window.waitForTimeout(500);
      }
    },
    output: "manual/transport-controls.png",
  },
  {
    description: "Status bar at bottom of window",
    name: "manual-status-bar",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(300);
    },
    output: "manual/status-bar.png",
    selector: '[data-testid="status-bar"]',
  },
];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--list")) {
  console.log("\nAvailable screenshot targets:\n");
  for (const t of SCREENSHOT_TARGETS) {
    console.log(`  ${t.name.padEnd(30)} ${t.description}`);
    console.log(`  ${"".padEnd(30)} -> docs/images/${t.output}`);
  }
  console.log(`\n  Total: ${SCREENSHOT_TARGETS.length} targets\n`);
  process.exit(0);
}

const targetName = args.includes("--target")
  ? args[args.indexOf("--target") + 1]
  : null;
const captureAll = args.includes("--all") || !targetName;

const targets = captureAll
  ? SCREENSHOT_TARGETS
  : SCREENSHOT_TARGETS.filter((t) => t.name === targetName);

if (targets.length === 0) {
  console.error(`Unknown target: ${targetName}`);
  console.error(`Run with --list to see available targets.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nCapturing ${targets.length} screenshot(s)...\n`);

  // Ensure manual images directory exists
  const { mkdirSync } = await import("fs");
  mkdirSync(path.join(DOCS_IMAGES, "manual"), { recursive: true });

  let electronApp;
  try {
    // Build the app first
    console.log("Building app...");
    const { execSync } = await import("child_process");
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" });

    // Launch Electron using the local Romper instance (real local store)
    console.log("Launching Electron with local store...");
    electronApp = await electron.launch({
      args: [path.join(ROOT, "dist/electron/main/index.js")],
      env: {
        ...process.env,
      },
      timeout: 30000,
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 15000,
    });

    // Set a consistent viewport size for reproducible screenshots
    await window.setViewportSize({ height: 800, width: 1280 });
    await window.waitForTimeout(500);

    for (const target of targets) {
      try {
        console.log(`  Capturing: ${target.name} ...`);

        // Navigate to the right state
        await target.navigate(window);

        const outputPath = path.join(DOCS_IMAGES, target.output);

        if (target.captureOverride) {
          // Custom capture logic (e.g. clip regions, hover effects)
          await target.captureOverride(window, outputPath);
        } else if (target.selector) {
          // Crop to specific element
          const element = window.locator(target.selector).first();
          if (await element.isVisible({ timeout: 5000 })) {
            await element.screenshot({ path: outputPath });
          } else {
            console.warn(`    SKIP: selector "${target.selector}" not visible`);
            continue;
          }
        } else {
          // Full window screenshot
          await window.screenshot({ path: outputPath });
        }

        console.log(`    -> docs/images/${target.output}`);

        // Navigate back to kit browser for the next target
        // (reset state between captures)
        try {
          const isOnDetails = await window
            .locator('[data-testid="kit-details"]')
            .isVisible({ timeout: 500 })
            .catch(() => false);
          if (isOnDetails) {
            // Click the back button (contains "Back" text with ArrowLeft icon)
            const backBtn = window.locator('button:has-text("Back")').first();
            if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
              await backBtn.click();
            }
          }
          // Wait for kit grid to be visible regardless of how we got here
          await window.waitForSelector('[data-testid="kit-grid"]', {
            timeout: 10000,
          });
          await window.waitForTimeout(300);
        } catch {
          // If we can't get back to kit browser, try reloading
          console.warn("    Resetting page state...");
          await window.reload();
          await window.waitForSelector('[data-testid="kits-view"]', {
            timeout: 15000,
          });
          await window.waitForTimeout(500);
        }
      } catch (err) {
        console.error(`    FAIL: ${target.name} - ${err.message}`);
      }
    }

    console.log("\nDone.\n");
  } finally {
    if (electronApp) await electronApp.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
