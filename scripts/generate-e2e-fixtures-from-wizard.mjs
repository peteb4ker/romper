#!/usr/bin/env node

/**
 * E2E Fixtures Generator - Reuses Existing Wizard E2E Test
 * 
 * This script imports and runs the proven working wizard E2E test,
 * then captures the database result as fixtures for other E2E tests.
 */

import fs from "fs-extra";
import os from "os";
import path from "path";
import archiver from "archiver";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_ROOT = path.resolve(__dirname, "../tests/fixtures");
const SDCARD_FIXTURES_PATH = path.join(FIXTURES_ROOT, "sdcard");
const OUTPUT_DIR = path.resolve(__dirname, "../tests/fixtures/e2e");
const FIXTURE_ARCHIVE_NAME = "local-store-fixture.tar.gz";

/**
 * Import the working wizard test function
 * This is the exact same function that runs successfully in E2E tests
 */
async function importWizardTest() {
  const wizardTestPath = path.resolve(__dirname, "../app/renderer/components/hooks/wizard/__tests__/localStoreWizard.e2e.test.ts");
  
  // For TypeScript imports in Node, we need to compile or use dynamic import
  // Since this is an admin script, let's use a simpler approach - extract the runWizardTest logic
  return { runWizardTest };
}

/**
 * Extracted runWizardTest function from the working E2E test
 * This ensures identical behavior to the proven working test
 */
async function runWizardTest({ fixturePath, source }) {
  const { _electron: electron } = await import("@playwright/test");
  
  // An empty ROMPER_LOCAL_PATH means "no override", so the wizard auto-opens;
  // the target is typed into the wizard instead.
  const env = {
    ...process.env,
    ROMPER_SDCARD_PATH: fixturePath,
    ROMPER_LOCAL_PATH: "",
  };
  const targetPath = path.join(os.tmpdir(), `romper-e2e-${source}-${Date.now()}`);

  console.log(`[E2E Wizard] Target local store: ${targetPath}`);
  console.log(`[E2E Wizard] ROMPER_SDCARD_PATH: ${env.ROMPER_SDCARD_PATH}`);

  const mainFile = path.resolve("dist/electron/main/index.js");
  if (!fs.existsSync(mainFile)) {
    throw new Error(`Main file does not exist: ${mainFile}`);
  }

  const electronApp = await electron.launch({
    args: [
      "dist/electron/main/index.js",
      ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
    ],
    env,
    timeout: 30000,
  });

  const window = await electronApp.firstWindow();

  // Wait for the wizard to auto-open
  await window.waitForSelector('[data-testid="local-store-wizard"]', {
    state: "visible",
  });

  // 1. Select SD card source
  const sourceSelector = `[data-testid="wizard-source-${source}"]`;
  await window.waitForSelector(sourceSelector, { state: "visible" });
  await window.click(sourceSelector);

  // 2. Set target path
  await window.waitForSelector("#local-store-path-input", { state: "visible" });
  await window.fill("#local-store-path-input", targetPath);

  // 3. Initialize
  await window.waitForFunction(() => {
    const btn = document.querySelector('[data-testid="wizard-initialize-btn"]');
    return btn && !btn.disabled;
  });

  await window.click('[data-testid="wizard-initialize-btn"]');

  // Wait for wizard completion, dismissing post-init guidance if it shows
  await Promise.race([
    window.waitForSelector('[data-testid="local-store-wizard"]', {
      state: "hidden",
      timeout: 30000,
    }),
    window
      .waitForSelector('[data-testid="wizard-post-init-guidance"]', {
        state: "visible",
        timeout: 30000,
      })
      .then(async () => {
        await window.click('[data-testid="post-init-continue-btn"]');
        await window.waitForSelector('[data-testid="local-store-wizard"]', {
          state: "hidden",
          timeout: 10000,
        });
      }),
  ]);

  // Verify database was created
  const dbPath = path.join(targetPath, ".romperdb", "romper.sqlite");
  await waitForFileExists(dbPath);
  
  await electronApp.close();
  
  return { localStorePath: targetPath, dbPath };
}

/**
 * Short synthesized drum hits, written as 16-bit 44.1 kHz mono PCM so the app
 * can decode them. Deterministic (seeded noise), so regenerating is a no-op.
 */
const SAMPLE_RATE = 44100;

function encodeWav(samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  samples.forEach((v, i) => {
    const clamped = Math.max(-1, Math.min(1, v));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  });
  return buf;
}

function synthKick() {
  // Sine with a fast downward pitch sweep and exponential decay
  const samples = new Float32Array(Math.round(0.15 * SAMPLE_RATE));
  let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    phase += (2 * Math.PI * (50 + 100 * Math.exp(-t * 30))) / SAMPLE_RATE;
    samples[i] = 0.9 * Math.sin(phase) * Math.exp(-t * 25);
  }
  return encodeWav(samples);
}

function synthSnare() {
  // Seeded noise burst over a short 180 Hz body
  const samples = new Float32Array(Math.round(0.1 * SAMPLE_RATE));
  let seed = 1;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 2 ** 32) * 2 - 1;
  };
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] =
      0.5 * noise() * Math.exp(-t * 35) +
      0.4 * Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 40);
  }
  return encodeWav(samples);
}

async function writeFixtureWavs() {
  const kick = synthKick();
  const snare = synthSnare();
  const targets = [
    ["kick.wav", kick],
    ["snare.wav", snare],
    ["sdcard/A0/1_kick.wav", kick],
    ["sdcard/A0/2_snare.wav", snare],
    ["sdcard/B1/1_kick.wav", kick],
    ["sdcard/B1/2_snare.wav", snare],
  ];
  for (const [relPath, data] of targets) {
    await fs.outputFile(path.join(FIXTURES_ROOT, relPath), data);
  }
  console.log(`🔊 Wrote ${targets.length} fixture WAVs`);
}

/**
 * The wizard records each sample's absolute source_path, which only exists on
 * this machine. Store it relative to the local store root instead; the E2E
 * fixture extractor resolves it against wherever the archive is extracted.
 */
async function relativizeSampleSourcePaths(localStorePath) {
  const db = new DatabaseSync(
    path.join(localStorePath, ".romperdb", "romper.sqlite"),
  );
  try {
    const rows = db
      .prepare("SELECT id, kit_name, filename FROM samples")
      .all();
    const update = db.prepare("UPDATE samples SET source_path = ? WHERE id = ?");
    for (const { id, kit_name, filename } of rows) {
      if (!(await fs.pathExists(path.join(localStorePath, kit_name, filename)))) {
        throw new Error(`Sample not copied into local store: ${kit_name}/${filename}`);
      }
      update.run(`${kit_name}/${filename}`, id);
    }
    // Fold the WAL back into the main file so the archive is self-contained
    db.exec("PRAGMA journal_mode = DELETE");
    console.log(`🔗 Stored ${rows.length} sample source paths relative to the local store`);
  } finally {
    db.close();
  }
}

// Helper function from the original E2E test
async function waitForFileExists(filePath, timeoutMs = 5000, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`File did not exist after ${timeoutMs}ms: ${filePath}`);
}

async function main() {
  try {
    console.log("🧙 E2E Fixtures Generator (Wizard-Based)");
    console.log("========================================");

    await writeFixtureWavs();

    console.log("🚀 Running wizard E2E test to generate database...");
    
    // Run the wizard test with SD card fixtures
    const { localStorePath } = await runWizardTest({
      fixturePath: SDCARD_FIXTURES_PATH,
      source: "sdcard"
    });

    console.log("✅ Wizard completed successfully!");
    console.log(`📁 Local store created at: ${localStorePath}`);

    // Get kit list from local store
    const kits = [];
    const contents = await fs.readdir(localStorePath);
    for (const item of contents) {
      const itemPath = path.join(localStorePath, item);
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory() && item.match(/^[A-Z]\d+$/)) {
        kits.push(item);
      }
    }

    console.log(`📦 Found ${kits.length} kits: ${kits.join(", ")}`);

    await relativizeSampleSourcePaths(localStorePath);

    // Create archive
    console.log("📦 Creating fixture archive...");
    await fs.ensureDir(OUTPUT_DIR);
    const archivePath = path.join(OUTPUT_DIR, FIXTURE_ARCHIVE_NAME);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath);
      const archive = archiver('tar', { gzip: true });

      output.on('close', () => {
        console.log(`📦 Archive created: ${archivePath} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(localStorePath, false);
      archive.finalize();
    });

    // Create metadata
    const metadataPath = path.join(OUTPUT_DIR, "fixture-metadata.json");
    const metadata = {
      generated: new Date().toISOString(),
      source: "Wizard E2E test automation",
      archivePath: path.basename(archivePath),
      kits: kits,
      usage: "Extract this archive to create a pre-initialized local store for E2E tests"
    };

    await fs.writeJSON(metadataPath, metadata, { spaces: 2 });

    console.log("🎉 E2E fixture generation completed successfully!");
    console.log("📁 Files created:");
    console.log(`   - ${archivePath}`);
    console.log(`   - ${metadataPath}`);
    console.log(`   - Kits: ${kits.join(", ")}`);

    // Clean up temp directory
    await fs.remove(localStorePath);
    console.log("🧹 Temporary directory cleaned up");

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);