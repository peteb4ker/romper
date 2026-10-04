/**
 * Screenshot Capture Script for Romper Documentation
 *
 * Launches the built app on a real local store (with actual kits) and
 * captures screenshots of specified views/elements for use in the website
 * and manual.
 *
 * The app runs with its own temporary settings folder, never the installed
 * app's: the store is written into a fresh romper-settings.json there, and
 * the folder is deleted afterwards. The store comes from --store, or else
 * from the installed app's settings, which are only read.
 *
 * Usage:
 *   npm run screenshots -- [--target <name>] [--all] [--list] [--store <path>]
 *
 * Targets are defined in SCREENSHOT_TARGETS below. New targets can be added
 * by appending to that array -- each target specifies a name, the navigation
 * steps to reach the view, an optional element selector to crop to, and the
 * output path under docs/images/.
 *
 * Targets marked `store: "broken-kits"` are captured from a generated store
 * with deliberately broken kits (tests/utils/broken-kit-store.ts), not the
 * user's.
 *
 * Examples:
 *   npm run screenshots -- --all          # capture everything
 *   npm run screenshots -- --target kit-browser
 *   npm run screenshots -- --target kit-editor
 *   npm run screenshots -- --list          # print available targets
 */

import type { Page } from "playwright";

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { _electron as electron } from "playwright";

import {
  createBrokenKitStore,
  MISSING_FILE_KIT,
  removeBrokenKitStore,
  UNREADABLE_FILE_KIT,
} from "../tests/utils/broken-kit-store";

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

interface PngHeader {
  channels: number;
  height: number;
  width: number;
}

/**
 * Capture a kit editor notice and the top of the voice panels below it,
 * where the affected slot's label shows.
 */
async function clipFromNotice(
  window: Page,
  testId: string,
  outputPath: string,
) {
  const notice = await window
    .locator(`[data-testid="${testId}"]`)
    .boundingBox();
  const row = await window
    .locator('[data-testid="voice-panels-row"]')
    .boundingBox();
  if (!notice || !row) throw new Error(`${testId} not visible`);
  const top = Math.max(0, notice.y - 8);
  await window.screenshot({
    clip: { height: row.y + 86 - top, width: 1280, x: 0, y: top },
    path: outputPath,
  });
}

/**
 * Decode an 8-bit, non-interlaced grey/RGB/RGBA PNG to RGBA pixels,
 * ignoring colour-profile chunks. Returns null for other formats.
 */
function decodePng(
  png: Buffer,
): { height: number; pixels: Uint8Array; width: number } | null {
  const chunks = readPngChunks(png);
  if (!chunks) return null;
  const { header } = chunks;
  const samples = unfilter(inflateSync(chunks.data), header);
  const { channels, height, width } = header;
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const src = samples.subarray(i * channels, (i + 1) * channels);
    const colour = channels >= 3;
    const hasAlpha = channels === 2 || channels === 4;
    pixels.set(
      [
        src[0],
        colour ? src[1] : src[0],
        colour ? src[2] : src[0],
        hasAlpha ? src[channels - 1] : 255,
      ],
      i * 4,
    );
  }
  return { height, pixels, width };
}

/** Open a kit in the broken-kit store and wait for its file check. */
async function openBrokenKit(window: Page, kit: string) {
  await window.waitForSelector('[data-testid="kit-grid"]', { timeout: 10000 });
  await window.locator(`[data-testid="kit-item-${kit}"]`).click();
  await window.waitForSelector('[data-testid="kit-editor"]', {
    timeout: 10000,
  });
  await window.locator('[data-testid^="sample-file-label-"]').first().waitFor();
  await window.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await window.waitForTimeout(300);
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

/** Header and image data of an 8-bit, non-interlaced grey/RGB/RGBA PNG. */
function readPngChunks(
  png: Buffer,
): { data: Buffer; header: PngHeader } | null {
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };
  let header: null | PngHeader = null;
  const idat: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const type = png.toString("ascii", at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      const channels = channelsByType[data[9]] ?? 0;
      if (data[8] !== 8 || !channels || data[12] !== 0) return null;
      header = {
        channels,
        height: data.readUInt32BE(4),
        width: data.readUInt32BE(0),
      };
    } else if (type === "IDAT") {
      idat.push(data);
    }
    at += 12 + length;
  }
  return header ? { data: Buffer.concat(idat), header } : null;
}

/**
 * If a freshly captured image has the same pixels as the committed one,
 * put the committed bytes back: encoders and colour-profile chunks differ,
 * so equal pixels can still show up as a modified file. Returns true when
 * the image is unchanged.
 */
function restoreIfUnchanged(output: string): boolean {
  const file = path.join(DOCS_IMAGES, output);
  let committed: Buffer;
  try {
    committed = execFileSync("git", ["show", `HEAD:docs/images/${output}`], {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return false; // a new image
  }
  const before = decodePng(committed);
  const after = decodePng(readFileSync(file));
  const same =
    !!before &&
    !!after &&
    before.width === after.width &&
    before.height === after.height &&
    before.pixels.every((v, i) => v === after.pixels[i]);
  if (same) writeFileSync(file, committed);
  return same;
}

/** Open the sequencer drawer and drop the grid's keyboard focus ring. */
async function showSequencer(window: Page) {
  const showBtn = window.locator('[data-testid="kit-step-sequencer-handle"]');
  if (await showBtn.isVisible()) {
    await showBtn.click();
    await window.waitForTimeout(500);
  }
  await window.evaluate(() => (document.activeElement as HTMLElement)?.blur());
}

/** Undo PNG row filters, giving the raw samples row by row. */
function unfilter(raw: Buffer, header: PngHeader): Uint8Array {
  const { channels, height, width } = header;
  const stride = width * channels;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? rows[y * stride + x - channels] : 0;
      const up = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const upLeft =
        y > 0 && x >= channels ? rows[(y - 1) * stride + x - channels] : 0;
      const predictors = [
        0,
        left,
        up,
        (left + up) >> 1,
        paeth(left, up, upLeft),
      ];
      rows[y * stride + x] = (line[x] + (predictors[filter] ?? 0)) & 0xff;
    }
  }
  return rows;
}

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
    description: "Kit Editor view - full window (website screenshots section)",
    name: "kit-editor",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      // Click the first kit to open details
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-editor"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(500);
    },
    output: "kit-editor.png",
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
    description: "Kit Editor header with navigation, name, lock, favorite",
    name: "manual-kit-editor-header",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-editor"]', {
        timeout: 10000,
      });
      await window.waitForTimeout(300);
    },
    output: "manual/kit-editor-header.png",
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
      await window.waitForSelector('[data-testid="kit-editor"]', {
        timeout: 10000,
      });
      // Let the slots' waveforms decode and draw
      await window.waitForTimeout(2000);
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
      await window.waitForSelector('[data-testid="kit-editor"]', {
        timeout: 10000,
      });
      await showSequencer(window);
    },
    output: "manual/step-sequencer.png",
    selector: '[data-testid="kit-step-sequencer"]',
  },
  {
    description:
      "Step sequencer example pattern: the C0 kit used in the manual's walkthrough",
    name: "manual-step-sequencer-example",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      // Bank C is below the fold: jump to it with its bank hotkey
      await window.keyboard.press("c");
      const kit = window.locator('[data-testid="kit-item-C0"]');
      await kit.waitFor({ state: "visible", timeout: 5000 });
      await kit.click();
      await window.waitForSelector('[data-testid="kit-editor"]', {
        timeout: 10000,
      });
      await showSequencer(window);
    },
    output: "manual/step-sequencer-example.png",
    selector: '[data-testid="kit-step-sequencer"]',
  },
  {
    captureOverride: async (window, outputPath) => {
      // Right-click on the first active step to show the condition popover.
      // Only step pads (gridcells): other toggles are aria-pressed too.
      const activeStep = window
        .locator('[role="gridcell"][aria-pressed="true"]')
        .first();
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
      await window.waitForSelector('[data-testid="kit-editor"]', {
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
      // Capture voice row 0's settings (Slice, Sample, Level with its value)
      // with their column titles above
      const slice = window.locator('[data-testid="slice-toggle-0"]');
      const level = window.locator('[data-testid="voice-volume-0"]');
      const ruler = window.locator('[data-testid="seq-step-ruler"]');
      await slice.waitFor({ state: "visible", timeout: 3000 });
      await level.waitFor({ state: "visible", timeout: 3000 });

      const sliceBox = await slice.boundingBox();
      // The level's label holds the slider and its value
      const levelBox = await level.locator("xpath=..").boundingBox();
      const rulerBox = await ruler.boundingBox();
      if (!sliceBox || !levelBox || !rulerBox) {
        throw new Error("Controls not visible");
      }

      const pad = 6;
      const x = sliceBox.x - pad;
      const y = rulerBox.y - pad;
      const width = levelBox.x + levelBox.width - sliceBox.x + pad * 2;
      const height = sliceBox.y + sliceBox.height - rulerBox.y + pad * 2;

      await window.screenshot({
        clip: { height, width, x, y },
        path: outputPath,
      });
    },
    description: "Voice settings: slice mode, sample mode, level",
    name: "manual-voice-controls",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-editor"]', {
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
      // Capture the transport column (play, BPM, loop indicator, shortcuts)
      const controls = window.locator(
        '[data-testid="kit-step-sequencer-controls"]',
      );
      await controls.waitFor({ state: "visible", timeout: 3000 });
      await controls.screenshot({ path: outputPath });
    },
    description:
      "Sequencer transport controls: play/stop, BPM, loop indicator, shortcuts",
    name: "manual-transport-controls",
    navigate: async (window) => {
      await window.waitForSelector('[data-testid="kit-grid"]', {
        timeout: 10000,
      });
      const firstKit = window.locator('[data-testid^="kit-item-"]').first();
      await firstKit.waitFor({ state: "visible", timeout: 5000 });
      await firstKit.click();
      await window.waitForSelector('[data-testid="kit-editor"]', {
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

  // -- Broken kits (#537), from a generated store (tests/utils/broken-kit-store.ts) --
  {
    description: "Kit card of a quarantined kit, with the quarantine icon",
    name: "manual-kit-card-quarantined",
    navigate: async (window) => {
      // The kit's files are checked when it opens
      await openBrokenKit(window, UNREADABLE_FILE_KIT);
      await window
        .locator('[data-testid="kit-header"]')
        .getByTitle("Back")
        .click();
      await window
        .locator(
          `[data-testid="kit-item-${UNREADABLE_FILE_KIT}"] [data-testid="quarantine-indicator"]`,
        )
        .waitFor();
      await window.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      await window.waitForTimeout(300);
    },
    output: "manual/kit-card-quarantined.png",
    selector: `[data-testid="kit-item-${UNREADABLE_FILE_KIT}"]`,
    store: "broken-kits",
  },
  {
    description: "Kit Editor header of a quarantined kit",
    name: "manual-kit-editor-header-quarantined",
    navigate: async (window) => {
      await openBrokenKit(window, UNREADABLE_FILE_KIT);
    },
    output: "manual/kit-editor-header-quarantined.png",
    selector: '[data-testid="kit-header"]',
    store: "broken-kits",
  },
  {
    captureOverride: async (window, outputPath) => {
      await clipFromNotice(window, "kit-quarantine-notice", outputPath);
    },
    description:
      "Kit Editor: a file Romper can't read, its label and the quarantine notice",
    name: "manual-unreadable-file",
    navigate: async (window) => {
      await openBrokenKit(window, UNREADABLE_FILE_KIT);
    },
    output: "manual/unreadable-file.png",
    store: "broken-kits",
  },
  {
    captureOverride: async (window, outputPath) => {
      await clipFromNotice(window, "kit-missing-files-notice", outputPath);
    },
    description:
      "Kit Editor: a missing file, its label and the missing-files notice",
    name: "manual-missing-file",
    navigate: async (window) => {
      await openBrokenKit(window, MISSING_FILE_KIT);
      await window.locator('[data-testid="sample-file-label-2-0"]').waitFor();
    },
    output: "manual/missing-file.png",
    store: "broken-kits",
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

// --target takes one name or a comma-separated list (one build for all)
const targetArg = args.includes("--target")
  ? args[args.indexOf("--target") + 1]
  : null;
const targetNames = targetArg ? targetArg.split(",").map((n) => n.trim()) : [];
const captureAll = args.includes("--all") || targetNames.length === 0;

const targets = captureAll
  ? SCREENSHOT_TARGETS
  : SCREENSHOT_TARGETS.filter((t) => targetNames.includes(t.name));
const unknown = targetNames.filter(
  (n) => !SCREENSHOT_TARGETS.some((t) => t.name === n),
);

if (targets.length === 0 || unknown.length > 0) {
  console.error(`Unknown target: ${unknown.join(", ") || targetArg}`);
  console.error(`Run with --list to see available targets.`);
  process.exit(1);
}

const storeArg = args.includes("--store")
  ? args[args.indexOf("--store") + 1]
  : null;

/** The installed app's settings file, which this script only reads */
function installedSettingsFile(): string {
  const appData =
    process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support")
      : process.platform === "win32"
        ? (process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"))
        : (process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"));
  return path.join(appData, "Romper", "romper-settings.json");
}

/** The local store to capture: --store, else the installed app's */
function resolveStore(): string {
  if (storeArg) return path.resolve(storeArg);
  const file = installedSettingsFile();
  let store: unknown;
  try {
    store = JSON.parse(readFileSync(file, "utf8")).localStorePath;
  } catch {
    store = undefined;
  }
  if (typeof store !== "string" || !store) {
    console.error(`No local store in ${file}. Pass one with --store <path>.`);
    process.exit(1);
  }
  return store;
}

// Targets marked `store: "broken-kits"` use a generated store with broken
// kits (#537); the rest use --store or the installed app's
const userTargets = targets.filter((t) => !("store" in t));
const brokenKitTargets = targets.filter((t) => "store" in t);

const store = userTargets.length > 0 ? resolveStore() : null;
if (store && !existsSync(path.join(store, ".romperdb"))) {
  console.error(`Not a Romper local store (no .romperdb): ${store}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Launch the app on one store and capture its targets */
async function capture(
  store: string,
  targets: (typeof SCREENSHOT_TARGETS)[number][],
) {
  // Settings of its own, so the installed app's are never read or written
  // by the app. Saved settings rather than ROMPER_LOCAL_PATH, so there's no
  // Test Mode banner in the screenshots.
  const userData = mkdtempSync(path.join(os.tmpdir(), "romper-screenshots-"));
  writeFileSync(
    path.join(userData, "romper-settings.json"),
    JSON.stringify({ localStorePath: store }, null, 2),
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ROMPER_USER_DATA_DIR: userData,
  };
  delete env.ROMPER_LOCAL_PATH;

  let electronApp;
  try {
    console.log(`Launching Electron with local store ${store} ...`);
    electronApp = await electron.launch({
      args: [
        path.join(ROOT, "dist/electron/main/index.js"),
        `--user-data-dir=${userData}`,
      ],
      env,
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

        // Keep the committed file when the pixels haven't changed, so a
        // docs PR only carries images that actually look different
        if (restoreIfUnchanged(target.output)) {
          console.log(`    == docs/images/${target.output} (unchanged)`);
        } else {
          console.log(`    -> docs/images/${target.output}`);
        }

        // Navigate back to kit browser for the next target
        // (reset state between captures)
        try {
          const isOnDetails = await window
            .locator('[data-testid="kit-editor"]')
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
  } finally {
    if (electronApp) await electronApp.close();
    rmSync(userData, { force: true, recursive: true });
  }
}

async function main() {
  console.log(`\nCapturing ${targets.length} screenshot(s)...\n`);

  // Ensure manual images directory exists
  const { mkdirSync } = await import("node:fs");
  mkdirSync(path.join(DOCS_IMAGES, "manual"), { recursive: true });

  // Build the app first
  console.log("Building app...");
  const { execSync } = await import("node:child_process");
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });

  if (store && userTargets.length > 0) await capture(store, userTargets);
  if (brokenKitTargets.length > 0) {
    const brokenKits = await createBrokenKitStore();
    try {
      await capture(brokenKits.localStorePath, brokenKitTargets);
    } finally {
      await removeBrokenKitStore(brokenKits);
    }
  }
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
