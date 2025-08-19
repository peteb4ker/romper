import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  addKit,
  addSample,
  createRomperDbFile,
  getKitSamples,
  moveSample,
} from "../../romperDbCoreORM";

describe("Drag & Drop Operations - Integration Tests", () => {
  let tempDir: string;
  let dbDir: string;
  const testKitName = "TestKit";

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "romper-dragdrop-"));
    dbDir = join(tempDir, ".romperdb");
    await createRomperDbFile(dbDir);

    // Create test kit
    await addKit(dbDir, {
      bank_letter: "A",
      editable: true,
      name: testKitName,
    });
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  test("Insert operation: moving sample 6 to slot 1 produces correct order 1-6-2-3-4-5", async () => {
    // Setup: Create 6 samples in voice 1
    const sampleNames = [
      "sample1.wav",
      "sample2.wav",
      "sample3.wav",
      "sample4.wav",
      "sample5.wav",
      "sample6.wav",
    ];

    for (let i = 0; i < sampleNames.length; i++) {
      await addSample(dbDir, {
        filename: sampleNames[i],
        is_stereo: false,
        kit_name: testKitName,
        slot_number: i, // 0-based indexing
        source_path: `/path/to/${sampleNames[i]}`,
        voice_number: 1,
      });
    }

    // Verify initial order
    let samples = await getKitSamples(dbDir, testKitName);
    expect(samples.success).toBe(true);

    let voice1Samples = samples
      .data!.filter((s) => s.voice_number === 1)
      .sort((a, b) => a.slot_number - b.slot_number);

    expect(voice1Samples.map((s) => s.filename)).toEqual(sampleNames);

    // Perform move: sample6 (slot 5) to slot 1 (INSERT behavior)
    const result = moveSample(
      dbDir,
      testKitName,
      1, // fromVoice
      5, // fromSlot (sample6 at slot 5)
      1, // toVoice
      1 // toSlot (insert at slot 1)
    );

    expect(result.success).toBe(true);

    // Verify final order
    samples = await getKitSamples(dbDir, testKitName);
    voice1Samples = samples
      .data!.filter((s) => s.voice_number === 1)
      .sort((a, b) => a.slot_number - b.slot_number);

    const expectedOrder = [
      "sample1.wav", // slot 0 - stays
      "sample6.wav", // slot 1 - moved here from slot 5
      "sample2.wav", // slot 2 - shifted from 1
      "sample3.wav", // slot 3 - shifted from 2
      "sample4.wav", // slot 4 - shifted from 3
      "sample5.wav", // slot 5 - shifted from 4
    ];

    expect(voice1Samples.map((s) => s.filename)).toEqual(expectedOrder);

    // Verify slot numbers are contiguous 0-based
    expect(voice1Samples.map((s) => s.slot_number)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("Cross-voice move: sample from voice 1 to voice 2", async () => {
    // Setup: Create samples in voice 1 and voice 2
    const voice1Samples = [
      "v1_sample1.wav",
      "v1_sample2.wav",
      "v1_sample3.wav",
    ];
    const voice2Samples = ["v2_sample1.wav", "v2_sample2.wav"];

    for (let i = 0; i < voice1Samples.length; i++) {
      await addSample(dbDir, {
        filename: voice1Samples[i],
        is_stereo: false,
        kit_name: testKitName,
        slot_number: i,
        source_path: `/path/to/${voice1Samples[i]}`,
        voice_number: 1,
      });
    }

    for (let i = 0; i < voice2Samples.length; i++) {
      await addSample(dbDir, {
        filename: voice2Samples[i],
        is_stereo: false,
        kit_name: testKitName,
        slot_number: i,
        source_path: `/path/to/${voice2Samples[i]}`,
        voice_number: 2,
      });
    }

    // Move v1_sample2 from voice 1 slot 1 to voice 2 slot 1
    const result = moveSample(
      dbDir,
      testKitName,
      1, // fromVoice
      1, // fromSlot
      2, // toVoice
      1 // toSlot
    );

    expect(result.success).toBe(true);

    // Verify final state
    const samples = await getKitSamples(dbDir, testKitName);

    const finalVoice1 = samples
      .data!.filter((s) => s.voice_number === 1)
      .sort((a, b) => a.slot_number - b.slot_number);

    const finalVoice2 = samples
      .data!.filter((s) => s.voice_number === 2)
      .sort((a, b) => a.slot_number - b.slot_number);

    // Voice 1 should have samples compacted after removal
    expect(finalVoice1.map((s) => s.filename)).toEqual([
      "v1_sample1.wav",
      "v1_sample3.wav",
    ]);
    expect(finalVoice1.map((s) => s.slot_number)).toEqual([0, 1]);

    // Voice 2 should have the moved sample inserted
    expect(finalVoice2.map((s) => s.filename)).toEqual([
      "v2_sample1.wav",
      "v1_sample2.wav", // inserted at slot 1
      "v2_sample2.wav", // shifted to slot 2
    ]);
    expect(finalVoice2.map((s) => s.slot_number)).toEqual([0, 1, 2]);
  });

  test("Same-voice forward move: sample 2 to slot 4", async () => {
    const sampleNames = ["s1.wav", "s2.wav", "s3.wav", "s4.wav", "s5.wav"];

    for (let i = 0; i < sampleNames.length; i++) {
      await addSample(dbDir, {
        filename: sampleNames[i],
        is_stereo: false,
        kit_name: testKitName,
        slot_number: i,
        source_path: `/path/to/${sampleNames[i]}`,
        voice_number: 1,
      });
    }

    // Move s2 from slot 1 to slot 4
    const result = moveSample(dbDir, testKitName, 1, 1, 1, 4);
    expect(result.success).toBe(true);

    const samples = await getKitSamples(dbDir, testKitName);
    const voice1 = samples
      .data!.filter((s) => s.voice_number === 1)
      .sort((a, b) => a.slot_number - b.slot_number);

    // Expected: s1, s3, s4, s5, s2
    expect(voice1.map((s) => s.filename)).toEqual([
      "s1.wav",
      "s3.wav",
      "s4.wav",
      "s5.wav",
      "s2.wav",
    ]);
  });

  test("Same-voice backward move: sample 4 to slot 1", async () => {
    const sampleNames = ["s1.wav", "s2.wav", "s3.wav", "s4.wav", "s5.wav"];

    for (let i = 0; i < sampleNames.length; i++) {
      await addSample(dbDir, {
        filename: sampleNames[i],
        is_stereo: false,
        kit_name: testKitName,
        slot_number: i,
        source_path: `/path/to/${sampleNames[i]}`,
        voice_number: 1,
      });
    }

    // Move s4 from slot 3 to slot 1
    const result = moveSample(dbDir, testKitName, 1, 3, 1, 1);
    expect(result.success).toBe(true);

    const samples = await getKitSamples(dbDir, testKitName);
    const voice1 = samples
      .data!.filter((s) => s.voice_number === 1)
      .sort((a, b) => a.slot_number - b.slot_number);

    // Expected: s1, s4, s2, s3, s5
    expect(voice1.map((s) => s.filename)).toEqual([
      "s1.wav",
      "s4.wav",
      "s2.wav",
      "s3.wav",
      "s5.wav",
    ]);
  });

  test("Edge case: Move to beginning (slot 0)", async () => {
    const sampleNames = ["s1.wav", "s2.wav", "s3.wav"];

    for (let i = 0; i < sampleNames.length; i++) {
      await addSample(dbDir, {
        filename: sampleNames[i],
        is_stereo: false,
        kit_name: testKitName,
        slot_number: i,
        source_path: `/path/to/${sampleNames[i]}`,
        voice_number: 1,
      });
    }

    // Move s3 from slot 2 to slot 0
    const result = moveSample(dbDir, testKitName, 1, 2, 1, 0);
    expect(result.success).toBe(true);

    const samples = await getKitSamples(dbDir, testKitName);
    const voice1 = samples
      .data!.filter((s) => s.voice_number === 1)
      .sort((a, b) => a.slot_number - b.slot_number);

    // Expected: s3, s1, s2
    expect(voice1.map((s) => s.filename)).toEqual([
      "s3.wav",
      "s1.wav",
      "s2.wav",
    ]);
  });

  test("Edge case: Move to end (append)", async () => {
    const sampleNames = ["s1.wav", "s2.wav", "s3.wav"];

    for (let i = 0; i < sampleNames.length; i++) {
      await addSample(dbDir, {
        filename: sampleNames[i],
        is_stereo: false,
        kit_name: testKitName,
        slot_number: i,
        source_path: `/path/to/${sampleNames[i]}`,
        voice_number: 1,
      });
    }

    // Move s1 from slot 0 to slot 2 (which becomes an append after removal)
    const result = moveSample(dbDir, testKitName, 1, 0, 1, 2);
    expect(result.success).toBe(true);

    const samples = await getKitSamples(dbDir, testKitName);
    const voice1 = samples
      .data!.filter((s) => s.voice_number === 1)
      .sort((a, b) => a.slot_number - b.slot_number);

    // Expected: s2, s3, s1
    expect(voice1.map((s) => s.filename)).toEqual([
      "s2.wav",
      "s3.wav",
      "s1.wav",
    ]);
  });
});
