#!/usr/bin/env node

/**
 * Quick script to inspect sample gaps in the database
 * This will help us understand why samples are not contiguous
 */

import _path from "path";
import Database from "better-sqlite3";
import fs from "fs";

const DB_PATH = "/Users/pete/Downloads/romper/.romperdb/romper.sqlite";

function inspectSampleGaps() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("Database not found at:", DB_PATH);
    process.exit(1);
  }

  const db = Database(DB_PATH);

  try {
    // Get all samples ordered by kit, voice, and slot
    const samples = db
      .prepare(
        `
      SELECT kit_name, voice_number, slot_number, filename
      FROM samples 
      ORDER BY kit_name, voice_number, slot_number
    `,
      )
      .all();

    // Group by kit and voice to analyze gaps
    const kitVoices = {};
    for (const sample of samples) {
      const key = `${sample.kit_name}-voice-${sample.voice_number}`;
      if (!kitVoices[key]) {
        kitVoices[key] = [];
      }
      kitVoices[key].push({
        slot: sample.slot_number,
        filename: sample.filename,
      });
    }

    console.log("=== SAMPLE GAP ANALYSIS ===\n");

    for (const [key, voiceSamples] of Object.entries(kitVoices)) {
      console.log(`${key}:`);

      // Check for gaps
      const slots = voiceSamples.map((s) => s.slot).sort((a, b) => a - b);
      const gaps = [];

      for (let i = 1; i <= Math.max(...slots); i++) {
        if (!slots.includes(i)) {
          gaps.push(i);
        }
      }

      if (gaps.length > 0) {
        console.log(`  ❌ GAPS FOUND at slots: ${gaps.join(", ")}`);
        console.log(`  📋 Current slots: ${slots.join(", ")}`);
        voiceSamples.forEach((s) => {
          console.log(`    Slot ${s.slot}: ${s.filename}`);
        });
      } else {
        console.log(
          `  ✅ No gaps - contiguous from 1 to ${Math.max(...slots)}`,
        );
      }
      console.log("");
    }
  } finally {
    db.close();
  }
}

inspectSampleGaps();
