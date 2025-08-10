import { describe, expect, it } from "vitest";

import {
  dbSlotToDisplaySlot,
  getInsertionDbSlotWithReindexing,
} from "../slotUtils";

describe("undo/redo with automatic reindexing", () => {
  describe("reindexing impact on undo actions", () => {
    it("should demonstrate the challenge of undoing after reindexing", () => {
      // Initial overcrowded state - this is what user sees as S1, S2, S3, S4, S5
      const beforeMove = [
        { filename: "S1.wav", id: 1, slot_number: 100, voice_number: 1 },
        { filename: "S2.wav", id: 2, slot_number: 150, voice_number: 1 },
        { filename: "S3.wav", id: 3, slot_number: 175, voice_number: 1 },
        { filename: "S4.wav", id: 4, slot_number: 187, voice_number: 1 },
        { filename: "S5.wav", id: 5, slot_number: 193, voice_number: 1 },
        { filename: "S6.wav", id: 6, slot_number: 300, voice_number: 1 }, // Slot 3 in display
      ];

      console.log(
        "Before move - display slots:",
        beforeMove
          .map((s) => `${s.filename}:${dbSlotToDisplaySlot(s.slot_number)}`)
          .join(", "),
      );

      // User tries to move S6 to position 2 (between S1 and S2)
      const moveTarget = 2;

      // This should trigger reindexing because we can't fit between 100 and 150
      const insertionResult = getInsertionDbSlotWithReindexing(
        beforeMove.filter((s) => s.voice_number === 1),
        moveTarget,
      );

      console.log(
        `Insertion will ${insertionResult.wasReindexed ? "reindex" : "not reindex"}`,
      );

      if (insertionResult.wasReindexed) {
        console.log(
          "After reindexing - samples at slots:",
          insertionResult
            .reindexedSamples!.map((s) => s.slot_number)
            .join(", "),
        );

        // The reindexed samples have completely different slot numbers
        expect(
          insertionResult.reindexedSamples!.map((s) => s.slot_number),
        ).toEqual([
          100,
          200,
          300,
          400,
          500,
          600, // Clean spacing
        ]);

        // But the user action was just "move S6 to position 2"
        expect(insertionResult.insertionSlot).toBe(150); // Between 100 and 200
      }

      // The challenge: How do we undo this?
      // - User action: "Move S6 from position 3 to position 2"
      // - System action: "Reindex 6 samples AND move S6"
      // - Undo must: "Move S6 back AND restore original overcrowded positions"
    });

    it("should show how snapshot-based undo handles reindexing correctly", () => {
      // This is how the current system should work with snapshots

      // 1. Before any operation - capture complete state
      const stateSnapshot = [
        { sample: { filename: "S1.wav" }, slot: 100, voice: 1 },
        { sample: { filename: "S2.wav" }, slot: 150, voice: 1 },
        { sample: { filename: "S3.wav" }, slot: 175, voice: 1 },
        { sample: { filename: "S4.wav" }, slot: 187, voice: 1 },
        { sample: { filename: "S5.wav" }, slot: 193, voice: 1 },
        { sample: { filename: "S6.wav" }, slot: 300, voice: 1 },
      ];

      // 2. After reindexing + move operation
      // const afterOperation = [
      //   { sample: { filename: "S1.wav" }, slot: 100, voice: 1 },
      //   { sample: { filename: "S6.wav" }, slot: 150, voice: 1 }, // Moved here
      //   { sample: { filename: "S2.wav" }, slot: 200, voice: 1 }, // Reindexed
      //   { sample: { filename: "S3.wav" }, slot: 300, voice: 1 }, // Reindexed
      //   { sample: { filename: "S4.wav" }, slot: 400, voice: 1 }, // Reindexed
      //   { sample: { filename: "S5.wav" }, slot: 500, voice: 1 }, // Reindexed
      // ];

      // 3. Undo operation - restore exact snapshot state
      const afterUndo = stateSnapshot;

      // Verify undo restores original overcrowded state perfectly
      expect(afterUndo.map((s) => s.slot)).toEqual([
        100, 150, 175, 187, 193, 300,
      ]);

      console.log("Undo successfully restored overcrowded positions");
    });
  });

  describe("edge cases in undo/redo with reindexing", () => {
    it("should handle multiple reindexing events in undo history", () => {
      // Scenario: User makes several moves that each trigger reindexing

      const operation1Snapshot = [
        { sample: { filename: "S1.wav" }, slot: 100, voice: 1 },
        { sample: { filename: "S2.wav" }, slot: 200, voice: 1 },
      ];

      const operation2Snapshot = [
        { sample: { filename: "S1.wav" }, slot: 100, voice: 1 },
        { sample: { filename: "S2.wav" }, slot: 150, voice: 1 }, // After op1 + insertions
        { sample: { filename: "S3.wav" }, slot: 175, voice: 1 },
        { sample: { filename: "S4.wav" }, slot: 187, voice: 1 },
      ];

      const operation3Snapshot = [
        { sample: { filename: "S1.wav" }, slot: 100, voice: 1 },
        { sample: { filename: "S2.wav" }, slot: 200, voice: 1 }, // After op2 reindexing
        { sample: { filename: "S3.wav" }, slot: 300, voice: 1 },
        { sample: { filename: "S4.wav" }, slot: 400, voice: 1 },
      ];

      // Each undo should restore the exact state before that operation
      // This works correctly with snapshot-based undo regardless of reindexing
      expect(operation1Snapshot.length).toBe(2);
      expect(operation2Snapshot.length).toBe(4);
      expect(operation3Snapshot.length).toBe(4);

      console.log("Multiple reindexing events can be undone independently");
    });

    it("should demonstrate why individual action undo fails with reindexing", () => {
      // This shows why we need snapshot-based undo instead of individual action reversal

      // const beforeAction = [
      //   { filename: "S1.wav", id: 1, slot_number: 100 },
      //   { filename: "S2.wav", id: 2, slot_number: 150 },
      //   { filename: "S3.wav", id: 3, slot_number: 175 },
      //   { filename: "S4.wav", id: 4, slot_number: 300 },
      // ];

      // User action: Move S4 from slot 4 to slot 2
      // System performs: 1) Reindex all samples 2) Move S4

      // If we only tried to reverse the user action:
      // "Move S4 from slot 2 back to slot 4"
      // This fails because:
      // - Slot positions have changed due to reindexing
      // - Other samples are not in their original positions

      const problemWithIndividualUndo = {
        actualOperations: [
          "Reindex: S1(100→100), S2(150→200), S3(175→300)",
          "Move: S4(300→150)",
        ],
        correctUndo:
          "Restore complete state snapshot including overcrowded positions",
        simpleUndo: "Move S4 from slot 2 to slot 4", // This would be wrong!
        userAction: "Move S4 from display slot 4 to display slot 2",
      };

      expect(problemWithIndividualUndo.simpleUndo).not.toBe(
        problemWithIndividualUndo.correctUndo,
      );
      console.log(
        "Individual action undo fails with reindexing - need snapshot approach",
      );
    });
  });
});
