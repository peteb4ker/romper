#!/usr/bin/env node

/**
 * Generate the macOS installer DMG background image.
 *
 * Produces a branded, dark-themed background that matches the app icon
 * (four voice-colored LED dots — red / yellow / green / blue) with a clean
 * white "drag to install" arrow pointing from the app drop-zone toward the
 * /Applications shortcut.
 *
 * Text is rendered to vector paths from the app's own brand font (Inter,
 * app/renderer/fonts/Inter-Variable.woff2) via fontkit, so the output is
 * deterministic and does NOT depend on whatever fallback font sharp's bundled
 * librsvg/fontconfig happens to resolve (which produced an off-brand
 * DejaVu Sans render before).
 *
 * The icon positions baked into the layout here MUST stay in sync with the
 * `contents` coordinates in forge.config.cjs (@electron-forge/maker-dmg):
 *   app drop-zone   -> APP_X / ICON_Y
 *   /Applications   -> APPS_X / ICON_Y
 *
 * Outputs (consumed by Forge at release time, committed to the repo):
 *   electron/resources/dmg-background.png      (540x380  @1x)
 *   electron/resources/dmg-background@2x.png   (1080x760 @2x, retina)
 *
 * appdmg automatically picks up the `@2x` retina variant when it sits next to
 * the base image, so forge.config.cjs only references the @1x path.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import * as fontkit from "fontkit";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ---------------------------------------------------------------------------
// Window + drop-zone geometry (must match forge.config.cjs maker-dmg config)
// ---------------------------------------------------------------------------
const WIDTH = 540;
const HEIGHT = 380;
const APP_X = 140; // center of the app icon drop-zone
const APPS_X = 400; // center of the /Applications shortcut
const ICON_Y = 205; // shared vertical center of both icons

// ---------------------------------------------------------------------------
// Voice colors (dark-mode CSS values from app/renderer/styles/index.css)
// Shared with scripts/generate-app-icons.mjs to keep the brand consistent.
// ---------------------------------------------------------------------------
const VOICE_COLORS = [
  "#e05a60", // Voice 1 — red
  "#e8c846", // Voice 2 — yellow
  "#3daa78", // Voice 3 — green
  "#3a9fd4", // Voice 4 — blue
];

const TEXT_PRIMARY = "#f4f4f6";
const TEXT_MUTED = "#9a9aa4";

// Brand font (variable Inter, same file the renderer ships).
const FONT = fontkit.openSync(
  path.join(ROOT, "app/renderer/fonts/Inter-Variable.woff2"),
);

// ---------------------------------------------------------------------------
// Render a horizontal, center-anchored text run to baked SVG <path> elements.
//
// fontkit's variation (getVariation) support is broken for this woff2, so we
// lay out with the regular master and synthesize weight with a thin stroke of
// the same color (faux-bold) when `strokeWidth` > 0 — enough to give the
// wordmark presence without a separate font file.
// ---------------------------------------------------------------------------
function textRun(
  text,
  {
    fontSize,
    centerX,
    baselineY,
    tracking = 0,
    fill,
    opacity = 1,
    strokeWidth = 0,
  },
) {
  const run = FONT.layout(text);
  const scale = fontSize / FONT.unitsPerEm;

  const advances = run.glyphs.map((g) => g.advanceWidth * scale);
  const totalWidth =
    advances.reduce((a, b) => a + b, 0) + tracking * (run.glyphs.length - 1);

  let penX = centerX - totalWidth / 2;
  const stroke =
    strokeWidth > 0
      ? ` stroke="${fill}" stroke-width="${strokeWidth}" stroke-linejoin="round"`
      : "";

  let out = "";
  run.glyphs.forEach((glyph, i) => {
    // Bake scale (flip Y: font space is y-up, SVG is y-down) and position into
    // the path data so stroke-width stays in final pixel units.
    const d = glyph.path
      .scale(scale, -scale)
      .translate(penX, baselineY)
      .toSVG();
    if (d) {
      out += `<path d="${d}" fill="${fill}" opacity="${opacity}"${stroke}/>`;
    }
    penX += advances[i] + tracking;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Build the SVG. All coordinates are in @1x space; sharp rasterizes at the
// requested density for the retina variant.
// ---------------------------------------------------------------------------
function generateSvg() {
  // Brand accent: a row of four voice-colored dots under the wordmark.
  const dotRadius = 5;
  const dotGap = 26;
  const dotsWidth = dotGap * (VOICE_COLORS.length - 1);
  const dotsStartX = WIDTH / 2 - dotsWidth / 2;
  const dotsY = 132;
  let dots = "";
  let dotGlows = "";
  VOICE_COLORS.forEach((color, i) => {
    const cx = dotsStartX + dotGap * i;
    dotGlows += `<circle cx="${cx}" cy="${dotsY}" r="${dotRadius * 2.4}" fill="${color}" opacity="0.22" filter="url(#dotGlow)"/>`;
    dots += `<circle cx="${cx}" cy="${dotsY}" r="${dotRadius}" fill="${color}"/>`;
  });

  // Clean white install arrow spanning the gap between the two drop-zones,
  // drawn as a single unified silhouette (shaft + head) so there is no seam.
  const aStart = APP_X + 58;
  const aEnd = APPS_X - 58;
  const sh = 2.5; // shaft half-height
  const hh = 8; // arrowhead half-height
  const headLen = 16;
  const neck = aEnd - headLen;
  const arrow = `<path d="M ${aStart} ${ICON_Y - sh}
      L ${neck} ${ICON_Y - sh} L ${neck} ${ICON_Y - hh}
      L ${aEnd} ${ICON_Y} L ${neck} ${ICON_Y + hh} L ${neck} ${ICON_Y + sh}
      L ${aStart} ${ICON_Y + sh} Z"
      fill="${TEXT_PRIMARY}" opacity="0.92" stroke-linejoin="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="80%">
      <stop offset="0%" stop-color="#23232a"/>
      <stop offset="100%" stop-color="#131316"/>
    </radialGradient>
    <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  ${textRun("ROMPER", { fontSize: 52, centerX: WIDTH / 2, baselineY: 86, tracking: 14, fill: TEXT_PRIMARY, strokeWidth: 0.6 })}
  ${textRun("Sample Manager for Squarp Rample", { fontSize: 15, centerX: WIDTH / 2, baselineY: 112, tracking: 0.5, fill: TEXT_MUTED })}

  ${dotGlows}
  ${dots}

  ${arrow}

  ${textRun("DRAG TO INSTALL", { fontSize: 11, centerX: WIDTH / 2, baselineY: ICON_Y + 80, tracking: 3, fill: TEXT_MUTED })}
</svg>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Generating DMG background...\n");
  const svg = generateSvg();
  const svgBuffer = Buffer.from(svg);

  const targets = [
    { dest: "electron/resources/dmg-background.png", density: 72 },
    { dest: "electron/resources/dmg-background@2x.png", density: 144 },
  ];

  for (const { dest, density } of targets) {
    const buf = await sharp(svgBuffer, { density }).png().toBuffer();
    const p = path.join(ROOT, dest);
    fs.writeFileSync(p, buf);
    const { width, height } = await sharp(buf).metadata();
    console.log(`  -> ${dest} (${width}x${height})`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("DMG background generation failed:", err);
  process.exit(1);
});
