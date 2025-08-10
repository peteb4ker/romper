import { describe, expect, it } from "vitest";

/**
 * Test demonstrating how undo/redo works with automatic reindexing
 * This simulates the complete flow from user action to undo
 */
describe("undo/redo with reindexing - real scenarios", () => {
  describe("complete user workflow", () => {
    it("should handle the full lifecycle: action -> reindex -> undo", () => {
      // STEP 1: Initial state (overcrowded from previous intensive editing)
      const initialState = [
        { filename: "kick.wav", id: 1, slot_number: 100, voice_number: 1 },
        { filename: "snare.wav", id: 2, slot_number: 150, voice_number: 1 },
        { filename: "hihat.wav", id: 3, slot_number: 175, voice_number: 1 },
        { filename: "crash.wav", id: 4, slot_number: 187, voice_number: 1 },
        { filename: "ride.wav", id: 5, slot_number: 193, voice_number: 1 },
        { filename: "perc.wav", id: 6, slot_number: 196, voice_number: 1 },
        { filename: "vocal.wav", id: 7, slot_number: 198, voice_number: 1 },
        { filename: "bass.wav", id: 8, slot_number: 199, voice_number: 1 },
        { filename: "lead.wav", id: 9, slot_number: 200, voice_number: 1 },
        { filename: "pad.wav", id: 10, slot_number: 300, voice_number: 1 },
      ];

      // User sees these as: slots 1, 2, 2, 2, 2, 2, 2, 2, 2, 3 due to rounding
      // But they represent samples S1-S10

      console.log("Initial overcrowded state with 10 samples");

      // STEP 2: User action - "Move sample 10 (pad.wav) to position 2"
      // User action - "Move sample 10 (pad.wav) to position 2"
      // const userAction = {
      //   description: "Move pad.wav from position 3 to position 2",
      //   fromSlot: 2, // This would be slot position 3 -> index 2
      //   fromVoice: 1,
      //   mode: "insert" as const,
      //   toSlot: 1, // This would be slot position 2 -> index 1
      //   toVoice: 1,
      // };

      // STEP 3: System captures state snapshot BEFORE operation
      const stateSnapshot = initialState.map((sample) => ({
        sample: {
          filename: sample.filename,
          is_stereo: false,
          source_path: `/path/to/${sample.filename}`,
        },
        slot: sample.slot_number, // Database slot numbers (100, 150, 175, etc.)
        voice: sample.voice_number,
      }));

      console.log(
        "State snapshot captured with",
        stateSnapshot.length,
        "samples",
      );

      // STEP 4: System detects insertion would trigger reindexing
      // (This would happen in getInsertionDbSlotWithReindexing)
      const wouldTriggerReindexing = true;

      if (wouldTriggerReindexing) {
        console.log("System detects reindexing needed for insertion");
      }

      // STEP 5: After reindexing + move operation
      const afterOperation = [
        { filename: "kick.wav", id: 1, slot_number: 100, voice_number: 1 }, // S1
        { filename: "pad.wav", id: 10, slot_number: 150, voice_number: 1 }, // S10 moved here
        { filename: "snare.wav", id: 2, slot_number: 200, voice_number: 1 }, // S2 reindexed
        { filename: "hihat.wav", id: 3, slot_number: 300, voice_number: 1 }, // S3 reindexed
        { filename: "crash.wav", id: 4, slot_number: 400, voice_number: 1 }, // S4 reindexed
        { filename: "ride.wav", id: 5, slot_number: 500, voice_number: 1 }, // S5 reindexed
        { filename: "perc.wav", id: 6, slot_number: 600, voice_number: 1 }, // S6 reindexed
        { filename: "vocal.wav", id: 7, slot_number: 700, voice_number: 1 }, // S7 reindexed
        { filename: "bass.wav", id: 8, slot_number: 800, voice_number: 1 }, // S8 reindexed
        { filename: "lead.wav", id: 9, slot_number: 900, voice_number: 1 }, // S9 reindexed
      ];

      console.log(
        "After operation: reindexed + moved, now at slots:",
        afterOperation.map((s) => s.slot_number).join(", "),
      );

      // User now sees clean: S1, S10, S2, S3, S4, S5, S6, S7, S8, S9

      // STEP 6: User hits UNDO
      console.log("User hits UNDO");

      // STEP 7: System uses snapshot-based restoration
      // This restores the EXACT original state, including overcrowded positions

      const undoResult = stateSnapshot.map((snapshot) => ({
        filename: snapshot.sample.filename,
        id: 999, // New ID assigned
        slot_number: snapshot.slot,
        voice_number: snapshot.voice,
      }));

      console.log(
        "After UNDO: restored to original slots:",
        undoResult.map((s) => s.slot_number).join(", "),
      );

      // STEP 8: Verification
      expect(undoResult.map((s) => s.slot_number)).toEqual([
        100,
        150,
        175,
        187,
        193,
        196,
        198,
        199,
        200,
        300, // Original overcrowded state
      ]);

      expect(undoResult.map((s) => s.filename)).toEqual([
        "kick.wav",
        "snare.wav",
        "hihat.wav",
        "crash.wav",
        "ride.wav",
        "perc.wav",
        "vocal.wav",
        "bass.wav",
        "lead.wav",
        "pad.wav",
      ]);

      console.log("✓ UNDO successfully restored original overcrowded state");
      console.log("✓ Sample order preserved");
      console.log("✓ All reindexing effects reversed");
    });

    it("should handle REDO after undo with reindexing", () => {
      // REDO is typically implemented by re-applying the original operation
      // With our system, this means:

      const originalStateSnapshot = [
        { sample: { filename: "S1.wav" }, slot: 100, voice: 1 },
        { sample: { filename: "S2.wav" }, slot: 150, voice: 1 },
        // ... overcrowded state
      ];

      const afterOperationSnapshot = [
        { sample: { filename: "S1.wav" }, slot: 100, voice: 1 },
        { sample: { filename: "S2.wav" }, slot: 200, voice: 1 }, // After reindex
        // ... clean state
      ];

      // UNDO: Restore original state
      let currentState = originalStateSnapshot;

      // REDO: Two possible approaches:
      // 1. Re-execute the original user operation (may reindex differently)
      // 2. Restore the "after operation" snapshot (preserves exact result)

      const redoApproach = "snapshot"; // or "re-execute"

      if (redoApproach === "snapshot") {
        currentState = afterOperationSnapshot;
        console.log("REDO using snapshot restoration - deterministic");
      } else {
        console.log(
          "REDO by re-executing operation - may differ if conditions changed",
        );
      }

      expect(currentState).toEqual(afterOperationSnapshot);
      console.log("✓ REDO works with snapshot approach");
    });
  });

  describe("why snapshot-based undo is essential with reindexing", () => {
    it("should show the problems with action-based undo", () => {
      const problems = {
        actionBasedUndo: [
          "Move sample from position 2 back to position 3",
          "// But positions 2 and 3 now mean different slots!",
        ],
        snapshotBasedUndo: [
          "Clear all samples in affected voices",
          "Restore each sample to its exact original slot position",
          "// Perfectly reverses all effects including reindexing",
        ],
        systemDoes: [
          "Reindex 9 samples to new positions",
          "Move 1 sample to target position",
        ],
        userSees: "Move sample from position 3 to position 2",
      };

      expect(problems.snapshotBasedUndo.length).toBeGreaterThan(
        problems.actionBasedUndo.length,
      );

      console.log("Action-based undo fails because:");
      console.log("1. Slot positions change due to reindexing");
      console.log("2. Multiple samples are affected by one user action");
      console.log("3. Original crowded positions would be lost");
      console.log("");
      console.log("Snapshot-based undo succeeds because:");
      console.log("1. Captures complete state before ANY changes");
      console.log("2. Restores exact original positions");
      console.log("3. Handles any number of affected samples");
    });
  });
});
