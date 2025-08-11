/**
 * Integration tests for drag and drop functionality
 * Tests all move scenarios against a fresh SQLite database
 */

import * as schema from "@romper/shared/db/schema.js";
import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createRomperDbFile,
  ensureDatabaseMigrations,
} from "../../utils/dbUtilities.js";
import { moveSample } from "../sampleManagementOps.js";

const { kits, samples } = schema;

describe("Drag and Drop Integration Tests", () => {
  let testDbDir: string;
  let testDbPath: string;
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database;

  beforeEach(() => {
    // Create temporary directory for test database
    testDbDir = mkdtempSync(path.join(tmpdir(), "romper-test-"));
    testDbPath = path.join(testDbDir, "romper.sqlite");

    // Create fresh database
    const createResult = createRomperDbFile(testDbDir);
    expect(createResult.success).toBe(true);

    // Initialize Drizzle
    sqlite = new Database(testDbPath);
    db = drizzle(sqlite, { schema });

    // Ensure migrations are applied
    ensureDatabaseMigrations(testDbDir);

    // Create test kit
    db.insert(kits)
      .values({
        bank_letter: "T",
        editable: true,
        name: "TEST",
      })
      .run();

    // Insert test samples in voice 1 (slots 0-4)
    const testSamples = [
      {
        filename: "sample1.wav",
        is_stereo: false,
        kit_name: "TEST",
        slot_number: 0,
        source_path: "/path/to/sample1.wav",
        voice_number: 1,
      },
      {
        filename: "sample2.wav",
        is_stereo: false,
        kit_name: "TEST",
        slot_number: 1,
        source_path: "/path/to/sample2.wav",
        voice_number: 1,
      },
      {
        filename: "sample3.wav",
        is_stereo: false,
        kit_name: "TEST",
        slot_number: 2,
        source_path: "/path/to/sample3.wav",
        voice_number: 1,
      },
      {
        filename: "sample4.wav",
        is_stereo: false,
        kit_name: "TEST",
        slot_number: 3,
        source_path: "/path/to/sample4.wav",
        voice_number: 1,
      },
      {
        filename: "sample5.wav",
        is_stereo: false,
        kit_name: "TEST",
        slot_number: 4,
        source_path: "/path/to/sample5.wav",
        voice_number: 1,
      },
    ];

    for (const sample of testSamples) {
      db.insert(samples).values(sample).run();
    }

    // Insert test samples in voice 2 (slots 0-2)
    const voice2Samples = [
      {
        filename: "voice2_1.wav",
        is_stereo: false,
        kit_name: "TEST",
        slot_number: 0,
        source_path: "/path/to/voice2_1.wav",
        voice_number: 2,
      },
      {
        filename: "voice2_2.wav",
        is_stereo: false,
        kit_name: "TEST",
        slot_number: 1,
        source_path: "/path/to/voice2_2.wav",
        voice_number: 2,
      },
      {
        filename: "voice2_3.wav",
        is_stereo: false,
        kit_name: "TEST",
        slot_number: 2,
        source_path: "/path/to/voice2_3.wav",
        voice_number: 2,
      },
    ];

    for (const sample of voice2Samples) {
      db.insert(samples).values(sample).run();
    }
  });

  afterEach(() => {
    sqlite?.close();
    rmSync(testDbDir, { force: true, recursive: true });
  });

  // Helper function to get all samples for a voice sorted by slot
  function getSamplesInVoice(
    voiceNumber: number,
  ): Array<{ filename: string; slot_number: number }> {
    return db
      .select({ filename: samples.filename, slot_number: samples.slot_number })
      .from(samples)
      .where(
        and(
          eq(samples.kit_name, "TEST"),
          eq(samples.voice_number, voiceNumber),
        ),
      )
      .orderBy(samples.slot_number)
      .all();
  }

  // Helper function to verify contiguous slots starting from 0
  function verifyContiguousSlots(
    voiceNumber: number,
    expectedFilenames: string[],
  ) {
    const voiceSamples = getSamplesInVoice(voiceNumber);
    expect(voiceSamples).toHaveLength(expectedFilenames.length);

    for (let i = 0; i < expectedFilenames.length; i++) {
      expect(voiceSamples[i].slot_number).toBe(i); // 0-based indexing
      expect(voiceSamples[i].filename).toBe(expectedFilenames[i]);
    }
  }

  describe("Same Voice Moves", () => {
    it("should move sample forward within voice (slot 1 -> slot 3)", () => {
      // Initial: [sample1, sample2, sample3, sample4, sample5] at slots [0,1,2,3,4]
      // Move sample2 from slot 1 to slot 3
      // Expected: [sample1, sample3, sample4, sample2, sample5] at slots [0,1,2,3,4]

      const result = moveSample(testDbDir, "TEST", 1, 1, 1, 3);
      expect(result.success).toBe(true);

      verifyContiguousSlots(1, [
        "sample1.wav",
        "sample3.wav",
        "sample4.wav",
        "sample2.wav",
        "sample5.wav",
      ]);
    });

    it("should move sample backward within voice (slot 3 -> slot 1)", () => {
      // Initial: [sample1, sample2, sample3, sample4, sample5] at slots [0,1,2,3,4]
      // Move sample4 from slot 3 to slot 1
      // Expected: [sample1, sample4, sample2, sample3, sample5] at slots [0,1,2,3,4]

      const result = moveSample(testDbDir, "TEST", 1, 3, 1, 1);
      expect(result.success).toBe(true);

      verifyContiguousSlots(1, [
        "sample1.wav",
        "sample4.wav",
        "sample2.wav",
        "sample3.wav",
        "sample5.wav",
      ]);
    });

    it("should move first sample to middle (slot 0 -> slot 2)", () => {
      // Initial: [sample1, sample2, sample3, sample4, sample5] at slots [0,1,2,3,4]
      // Move sample1 from slot 0 to slot 2
      // Expected: [sample2, sample3, sample1, sample4, sample5] at slots [0,1,2,3,4]

      const result = moveSample(testDbDir, "TEST", 1, 0, 1, 2);
      expect(result.success).toBe(true);

      verifyContiguousSlots(1, [
        "sample2.wav",
        "sample3.wav",
        "sample1.wav",
        "sample4.wav",
        "sample5.wav",
      ]);
    });

    it("should move last sample to beginning (slot 4 -> slot 0)", () => {
      // Initial: [sample1, sample2, sample3, sample4, sample5] at slots [0,1,2,3,4]
      // Move sample5 from slot 4 to slot 0
      // Expected: [sample5, sample1, sample2, sample3, sample4] at slots [0,1,2,3,4]

      const result = moveSample(testDbDir, "TEST", 1, 4, 1, 0);
      expect(result.success).toBe(true);

      verifyContiguousSlots(1, [
        "sample5.wav",
        "sample1.wav",
        "sample2.wav",
        "sample3.wav",
        "sample4.wav",
      ]);
    });

    it("should handle no-op move (same position)", () => {
      // Move sample3 from slot 3 to slot 3 (no change)
      const result = moveSample(testDbDir, "TEST", 1, 3, 1, 3);
      expect(result.success).toBe(true);

      // Should remain unchanged
      verifyContiguousSlots(1, [
        "sample1.wav",
        "sample2.wav",
        "sample3.wav",
        "sample4.wav",
        "sample5.wav",
      ]);
    });
  });

  describe("Cross Voice Moves", () => {
    it("should move sample from voice 1 to voice 2 (append)", () => {
      // Move sample4 from voice 1 slot 3 to voice 2 slot 3 (append)
      const result = moveSample(testDbDir, "TEST", 1, 3, 2, 3);
      expect(result.success).toBe(true);

      // Voice 1 should compact: [sample1, sample2, sample3, sample5] at slots [0,1,2,3]
      verifyContiguousSlots(1, [
        "sample1.wav",
        "sample2.wav",
        "sample3.wav",
        "sample5.wav",
      ]);

      // Voice 2 should have new sample appended: [voice2_1, voice2_2, voice2_3, sample4] at slots [0,1,2,3]
      verifyContiguousSlots(2, [
        "voice2_1.wav",
        "voice2_2.wav",
        "voice2_3.wav",
        "sample4.wav",
      ]);
    });

    it("should move sample from voice 1 to voice 2 (insert)", () => {
      // Move sample3 from voice 1 slot 2 to voice 2 slot 1 (insert)
      const result = moveSample(testDbDir, "TEST", 1, 2, 2, 1);
      expect(result.success).toBe(true);

      // Voice 1 should compact: [sample1, sample2, sample4, sample5] at slots [0,1,2,3]
      verifyContiguousSlots(1, [
        "sample1.wav",
        "sample2.wav",
        "sample4.wav",
        "sample5.wav",
      ]);

      // Voice 2 should have sample inserted: [voice2_1, sample3, voice2_2, voice2_3] at slots [0,1,2,3]
      verifyContiguousSlots(2, [
        "voice2_1.wav",
        "sample3.wav",
        "voice2_2.wav",
        "voice2_3.wav",
      ]);
    });

    it("should move sample from voice 2 to voice 1 (insert at beginning)", () => {
      // Move voice2_2 from voice 2 slot 1 to voice 1 slot 0 (insert at beginning)
      const result = moveSample(testDbDir, "TEST", 2, 1, 1, 0);
      expect(result.success).toBe(true);

      // Voice 2 should compact: [voice2_1, voice2_3] at slots [0,1]
      verifyContiguousSlots(2, ["voice2_1.wav", "voice2_3.wav"]);

      // Voice 1 should have sample at beginning: [voice2_2, sample1, sample2, sample3, sample4, sample5] at slots [0,1,2,3,4,5]
      verifyContiguousSlots(1, [
        "voice2_2.wav",
        "sample1.wav",
        "sample2.wav",
        "sample3.wav",
        "sample4.wav",
        "sample5.wav",
      ]);
    });

    it("should move between empty slot ranges", () => {
      // Move from voice 1 to voice 3 (empty voice)
      const result = moveSample(testDbDir, "TEST", 1, 1, 3, 0);
      expect(result.success).toBe(true);

      // Voice 1 should compact: [sample1, sample3, sample4, sample5] at slots [0,1,2,3]
      verifyContiguousSlots(1, [
        "sample1.wav",
        "sample3.wav",
        "sample4.wav",
        "sample5.wav",
      ]);

      // Voice 3 should have the moved sample: [sample2] at slot [0]
      verifyContiguousSlots(3, ["sample2.wav"]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle move from invalid slot", () => {
      // Try to move from slot 12 (invalid in 0-11 system)
      const result = moveSample(testDbDir, "TEST", 1, 12, 1, 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid slot numbers. Must be 0-11");
    });

    it("should handle move to invalid slot", () => {
      // Move sample1 from slot 0 to slot 12 (invalid in 0-11 system)
      const result = moveSample(testDbDir, "TEST", 1, 0, 1, 12);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid slot numbers. Must be 0-11");
    });

    it("should maintain database constraints throughout move", () => {
      // This test ensures no temporary constraint violations occur
      // Move sample that would cause cascading shifts
      const result = moveSample(testDbDir, "TEST", 1, 4, 1, 0);
      expect(result.success).toBe(true);

      verifyContiguousSlots(1, [
        "sample5.wav",
        "sample1.wav",
        "sample2.wav",
        "sample3.wav",
        "sample4.wav",
      ]);

      // Verify no duplicate slots exist
      const allSamples = db
        .select()
        .from(samples)
        .where(eq(samples.kit_name, "TEST"))
        .all();
      const slotCounts = new Map<string, number>();

      for (const sample of allSamples) {
        const key = `${sample.voice_number}-${sample.slot_number}`;
        slotCounts.set(key, (slotCounts.get(key) || 0) + 1);
      }

      // Ensure no duplicate voice-slot combinations
      for (const [key, count] of slotCounts.entries()) {
        expect(count).toBe(1, `Duplicate samples found at ${key}`);
      }
    });
  });

  describe("Contiguity Verification", () => {
    it("should maintain contiguity after multiple moves", () => {
      // Perform several moves in sequence
      moveSample(testDbDir, "TEST", 1, 1, 1, 5); // Move first to last
      moveSample(testDbDir, "TEST", 1, 3, 1, 1); // Move middle to first
      moveSample(testDbDir, "TEST", 1, 4, 2, 1); // Move cross-voice

      // Verify both voices have contiguous slots
      const voice1Samples = getSamplesInVoice(1);
      const voice2Samples = getSamplesInVoice(2);

      // Check voice 1 contiguity
      for (let i = 0; i < voice1Samples.length; i++) {
        expect(voice1Samples[i].slot_number).toBe(i); // 0-based indexing
      }

      // Check voice 2 contiguity
      for (let i = 0; i < voice2Samples.length; i++) {
        expect(voice2Samples[i].slot_number).toBe(i); // 0-based indexing
      }
    });

    it("should handle moves that create temporary gaps", () => {
      // Move sample from middle, then move another to fill the gap
      moveSample(testDbDir, "TEST", 1, 3, 2, 1); // Move sample4 to voice 2

      // Voice 1 should compact automatically
      verifyContiguousSlots(1, [
        "sample1.wav",
        "sample2.wav",
        "sample3.wav",
        "sample5.wav",
      ]);

      // Voice 2 should have sample inserted
      verifyContiguousSlots(2, [
        "voice2_1.wav",
        "sample4.wav",
        "voice2_2.wav",
        "voice2_3.wav",
      ]);
    });
  });
});
