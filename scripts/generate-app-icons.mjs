#!/usr/bin/env node

/**
 * Generate app icons at multiple sizes with LED glow effect.
 *
 * Uses the same LFO wave math and row configs from the app's LED animation
 * system to produce a "frozen moment" of the animated icon with per-voice
 * colors (red / yellow / green / blue) in four quadrants.
 *
 * Outputs:
 *   electron/resources/app-icon.png   (1024x1024 master)
 *   electron/resources/app-icon.ico   (16/32/48/256 multi-res Windows)
 *   electron/resources/app-icon.icns  (macOS via iconutil, skipped on Linux)
 *   app/renderer/assets/app-icon.png  (copy of master)
 *   docs/images/app-icon.png          (copy of master)
 *   docs/images/favicon-16.png        (16x16)
 *   docs/images/favicon-32.png        (32x32)
 *   docs/images/apple-touch-icon.png  (180x180)
 */

import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ---------------------------------------------------------------------------
// Voice colors (dark-mode CSS values from index.css:103-106)
// ---------------------------------------------------------------------------
const VOICE_COLORS = [
  { hex: "#e05a60", r: 224, g: 90, b: 96 }, // Voice 1 — red   (top-left)
  { hex: "#e8c846", r: 232, g: 200, b: 70 }, // Voice 2 — yellow (top-right)
  { hex: "#3daa78", r: 61, g: 170, b: 120 }, // Voice 3 — green  (bottom-left)
  { hex: "#3a9fd4", r: 58, g: 159, b: 212 }, // Voice 4 — blue   (bottom-right)
];

const BG_COLOR = "#1a1a1e";

// ---------------------------------------------------------------------------
// LFO wave functions (from ledMath.ts)
// ---------------------------------------------------------------------------
function sine(t) {
  return (Math.sin(t * Math.PI * 2) + 1) * 0.5;
}
function triangle(t) {
  const w = ((t % 1) + 1) % 1;
  return w < 0.5 ? w * 2 : 2 - w * 2;
}
function saw(t) {
  return ((t % 1) + 1) % 1;
}
function waveFunction(type, t) {
  if (type === "sine") return sine(t);
  if (type === "triangle") return triangle(t);
  return saw(t);
}

// Row LFO configs (from ledIconConstants.ts:10-16)
const ROW_LFO_CONFIGS = [
  { frequency: 0.12, phase: 0.0, spatialFreq: 0.3, wave: "sine" },
  { frequency: 0.18, phase: 0.8, spatialFreq: 0.25, wave: "triangle" },
  { frequency: 0.09, phase: 1.6, spatialFreq: 0.35, wave: "saw" },
  { frequency: 0.22, phase: 2.4, spatialFreq: 0.2, wave: "sine" },
  { frequency: 0.15, phase: 3.2, spatialFreq: 0.4, wave: "triangle" },
  { frequency: 0.12, phase: 4.0, spatialFreq: 0.28, wave: "sine" },
];

// Brightness range — tighter than the animation to keep dots consistently visible
const BASE_MIN = 0.6;
const BASE_MAX = 1.0;
const BASE_SCALE = BASE_MAX - BASE_MIN;

// Fixed time point for the "frozen moment"
const FROZEN_TIME = 7.3;

// ---------------------------------------------------------------------------
// Dot-count table: how many dots per quadrant at each size
// ---------------------------------------------------------------------------
const DOT_CONFIGS = {
  1024: 6,
  512: 6,
  256: 4,
  180: 3,
  128: 3,
  64: 2,
  48: 2,
  32: 2,
  16: 1,
};

// ---------------------------------------------------------------------------
// Compute brightness for a dot at (col, row) in a grid of dotsPerSide
// ---------------------------------------------------------------------------
function computeBrightness(col, row, dotsPerSide) {
  const config = ROW_LFO_CONFIGS[row % ROW_LFO_CONFIGS.length];
  const t =
    FROZEN_TIME * config.frequency +
    config.phase +
    col * config.spatialFreq;
  const rowOffset = row * 0.1;
  const raw = waveFunction(config.wave, t + rowOffset);
  return BASE_MIN + raw * BASE_SCALE;
}

// ---------------------------------------------------------------------------
// Generate SVG for a single icon size
// ---------------------------------------------------------------------------
function generateSvg(size) {
  const dotsPerSide = DOT_CONFIGS[size] || 2;
  const padding = size * 0.1;
  const gap = size * 0.06; // narrower gap between quadrants
  const quadrantSize = (size - 2 * padding - gap) / 2;

  // Bigger dots with clean spacing — match the original's proportions
  const dotDiameter = quadrantSize / (dotsPerSide + (dotsPerSide - 1) * 0.4 + 0.8);
  const dotRadius = dotDiameter * 0.5;
  const dotStep = dotDiameter * 1.4; // center-to-center spacing
  const gridWidth = dotStep * (dotsPerSide - 1);
  const gridOffset = (quadrantSize - gridWidth) / 2; // center the grid in each quadrant

  // Quadrant origins (top-left corner of each quadrant)
  const quadrants = [
    { x: padding, y: padding, voice: 0 },
    { x: padding + quadrantSize + gap, y: padding, voice: 1 },
    { x: padding, y: padding + quadrantSize + gap, voice: 2 },
    { x: padding + quadrantSize + gap, y: padding + quadrantSize + gap, voice: 3 },
  ];

  let circles = "";
  let glows = "";
  const filterId = `glow-${size}`;

  for (const q of quadrants) {
    const color = VOICE_COLORS[q.voice];
    for (let row = 0; row < dotsPerSide; row++) {
      for (let col = 0; col < dotsPerSide; col++) {
        const cx = q.x + gridOffset + dotStep * col;
        const cy = q.y + gridOffset + dotStep * row;
        const brightness = computeBrightness(col + q.voice * dotsPerSide, row, dotsPerSide);

        // Dot color with brightness applied
        const dr = Math.round(color.r * brightness);
        const dg = Math.round(color.g * brightness);
        const db = Math.round(color.b * brightness);
        const dotColor = `rgb(${dr},${dg},${db})`;

        // Main dot
        circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${dotRadius.toFixed(1)}" fill="${dotColor}"/>`;

        // Subtle glow halo for brighter dots only
        if (brightness > 0.75) {
          const glowIntensity = (brightness - 0.75) * 4; // 0..1
          const glowRadius = dotRadius * 1.6;
          const glowOpacity = glowIntensity * 0.25;
          glows += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${glowRadius.toFixed(1)}" fill="${color.hex}" opacity="${glowOpacity.toFixed(2)}" filter="url(#${filterId})"/>`;
        }
      }
    }
  }

  // Subtle blur for glow
  const blurStdDev = Math.max(1, size * 0.008).toFixed(1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${blurStdDev}" />
    </filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.16)}" fill="${BG_COLOR}"/>
  ${glows}
  ${circles}
</svg>`;
}

// ---------------------------------------------------------------------------
// Render SVG to PNG buffer at a given size
// ---------------------------------------------------------------------------
async function renderIcon(size) {
  const svg = generateSvg(size);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------------------------------------------------------------------------
// Build ICO container (header + directory + embedded PNGs)
// ICO spec: https://en.wikipedia.org/wiki/ICO_(file_format)
// ---------------------------------------------------------------------------
function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * count;
  let dataOffset = headerSize + dirSize;

  // Header: reserved(2) + type(2) + count(2)
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = ICO
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  for (let i = 0; i < count; i++) {
    const entry = Buffer.alloc(dirEntrySize);
    const s = sizes[i];
    entry.writeUInt8(s >= 256 ? 0 : s, 0); // width (0 = 256)
    entry.writeUInt8(s >= 256 ? 0 : s, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8); // data size
    entry.writeUInt32LE(dataOffset, 12); // data offset
    dataOffset += pngBuffers[i].length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

// ---------------------------------------------------------------------------
// Build ICNS via macOS iconutil
// ---------------------------------------------------------------------------
async function buildIcns(outputPath) {
  if (os.platform() !== "darwin") {
    console.log("  Skipping .icns generation (not on macOS)");
    return;
  }

  const iconsetDir = path.join(os.tmpdir(), "romper-icon.iconset");
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }
  fs.mkdirSync(iconsetDir);

  // iconutil requires specific filenames
  const iconsetSizes = [
    { name: "icon_16x16.png", size: 16 },
    { name: "icon_16x16@2x.png", size: 32 },
    { name: "icon_32x32.png", size: 32 },
    { name: "icon_32x32@2x.png", size: 64 },
    { name: "icon_128x128.png", size: 128 },
    { name: "icon_128x128@2x.png", size: 256 },
    { name: "icon_256x256.png", size: 256 },
    { name: "icon_256x256@2x.png", size: 512 },
    { name: "icon_512x512.png", size: 512 },
    { name: "icon_512x512@2x.png", size: 1024 },
  ];

  // Render each needed size (de-duplicate)
  const uniqueSizes = [...new Set(iconsetSizes.map((s) => s.size))];
  const rendered = {};
  for (const size of uniqueSizes) {
    rendered[size] = await renderIcon(size);
  }

  for (const { name, size } of iconsetSizes) {
    fs.writeFileSync(path.join(iconsetDir, name), rendered[size]);
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${outputPath}"`);
  fs.rmSync(iconsetDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Generating app icons...\n");

  // 1. Master 1024x1024
  console.log("  Rendering 1024x1024 master...");
  const master = await renderIcon(1024);
  const masterPath = path.join(ROOT, "electron/resources/app-icon.png");
  fs.writeFileSync(masterPath, master);
  console.log(`  -> ${path.relative(ROOT, masterPath)}`);

  // 2. Copy master to renderer assets and docs
  for (const dest of [
    "app/renderer/assets/app-icon.png",
    "docs/images/app-icon.png",
  ]) {
    const p = path.join(ROOT, dest);
    fs.copyFileSync(masterPath, p);
    console.log(`  -> ${dest}`);
  }

  // 3. Favicon and touch icon for docs
  console.log("\n  Rendering favicons...");
  for (const { size, dest } of [
    { size: 16, dest: "docs/images/favicon-16.png" },
    { size: 32, dest: "docs/images/favicon-32.png" },
    { size: 180, dest: "docs/images/apple-touch-icon.png" },
  ]) {
    const buf = await renderIcon(size);
    const p = path.join(ROOT, dest);
    fs.writeFileSync(p, buf);
    console.log(`  -> ${dest} (${size}x${size})`);
  }

  // 4. ICO for Windows
  console.log("\n  Building Windows .ico...");
  const icoSizes = [16, 32, 48, 256];
  const icoPngs = [];
  for (const size of icoSizes) {
    icoPngs.push(await renderIcon(size));
  }
  const icoBuffer = buildIco(icoPngs, icoSizes);
  const icoPath = path.join(ROOT, "electron/resources/app-icon.ico");
  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`  -> electron/resources/app-icon.ico (${icoSizes.join("/")})`);

  // 5. ICNS for macOS
  console.log("\n  Building macOS .icns...");
  const icnsPath = path.join(ROOT, "electron/resources/app-icon.icns");
  await buildIcns(icnsPath);
  if (fs.existsSync(icnsPath)) {
    console.log(`  -> electron/resources/app-icon.icns`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
