import { describe, expect, it, vi } from "vitest";

import {
  type AddSampleAction,
  type AnyUndoAction,
  createActionId,
  type DeleteSampleAction,
  getActionDescription,
  type MoveSampleAction,
  type MoveSampleBetweenKitsAction,
  type ReindexSamplesAction,
} from "../undoTypes";

describe("undoTypes", () => {
  describe("createActionId", () => {
    it("generates unique IDs", () => {
      const id1 = createActionId();
      const id2 = createActionId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
      expect(typeof id2).toBe("string");
    });

    it("generates IDs with timestamp prefix", () => {
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);

      const id = createActionId();

      expect(id).toMatch(new RegExp(`^${now}-[a-f0-9]{8}$`));

      vi.restoreAllMocks();
    });

    it("generates IDs with correct format", () => {
      const id = createActionId();

      // Should match format: timestamp-randomstring
      expect(id).toMatch(/^\d+-[a-f0-9]{8}$/);
    });

    it("takes the suffix from crypto.randomUUID", () => {
      vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
        "4fa2c9e1-7b3d-4c8e-9a1f-2d3e4f5a6b7c",
      );
      vi.spyOn(Date, "now").mockReturnValue(1000000000000);

      expect(createActionId()).toBe("1000000000000-4fa2c9e1");

      vi.restoreAllMocks();
    });

    // #669: the suffix came from Math.random().toString(36), which drops
    // trailing zeros, so its length varied
    it("[Q-07] always has an 8-character suffix", () => {
      vi.spyOn(Date, "now").mockReturnValue(1000000000000);

      // (0.5).toString(36) is "0.i": the old suffix was just "i"
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      expect(createActionId()).toMatch(/^1000000000000-[a-f0-9]{8}$/);

      // Leading zeros are kept
      vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
        "00000000-0000-4000-8000-000000000000",
      );
      expect(createActionId()).toBe("1000000000000-00000000");

      vi.restoreAllMocks();
    });
  });

  const mockSample = {
    filename: "test.wav",
    source_path: "/path/to/test.wav",
  };

  describe("getActionDescription", () => {
    describe("ADD_SAMPLE action", () => {
      it("returns correct description for add sample action", () => {
        const action: AddSampleAction = {
          data: {
            addedSample: mockSample,
            slot: 0,
            voice: 1,
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "ADD_SAMPLE",
        };

        const description = getActionDescription(action);

        expect(description).toBe("Undo add sample to voice 1, slot 1");
      });

      it("handles different voice and slot numbers", () => {
        const action: AddSampleAction = {
          data: {
            addedSample: mockSample,
            slot: 7,
            voice: 3,
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "ADD_SAMPLE",
        };

        const description = getActionDescription(action);

        expect(description).toBe("Undo add sample to voice 3, slot 8");
      });
    });

    describe("DELETE_SAMPLE action", () => {
      it("returns correct description for delete sample action", () => {
        const action: DeleteSampleAction = {
          data: {
            deletedSample: mockSample,
            slot: 1,
            voice: 4,
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "DELETE_SAMPLE",
        };

        const description = getActionDescription(action);

        expect(description).toBe("Undo delete sample from voice 4, slot 2");
      });
    });

    describe("MOVE_SAMPLE action", () => {
      it("returns correct description for move sample action", () => {
        const action: MoveSampleAction = {
          data: {
            affectedSamples: [],
            fromSlot: 0,
            fromVoice: 1,
            mode: "insert",
            movedSample: mockSample,
            toSlot: 3,
            toVoice: 2,
            voicesBefore: [],
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE",
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo move sample from voice 1, slot 1 to voice 2, slot 4",
        );
      });

      it("handles different move coordinates", () => {
        const action: MoveSampleAction = {
          data: {
            affectedSamples: [],
            fromSlot: 7,
            fromVoice: 3,
            mode: "insert",
            movedSample: mockSample,
            toSlot: 2,
            toVoice: 1,
            voicesBefore: [],
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE",
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo move sample from voice 3, slot 8 to voice 1, slot 3",
        );
      });
    });

    describe("MOVE_SAMPLE_BETWEEN_KITS action", () => {
      it("returns correct description for move sample between kits action", () => {
        const action: MoveSampleBetweenKitsAction = {
          data: {
            affectedSamples: [],
            fromKit: "A0",
            fromSlot: 0,
            fromVoice: 1,
            mode: "insert",
            movedSample: mockSample,
            toKit: "B5",
            toSlot: 2,
            toVoice: 3,
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE_BETWEEN_KITS",
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo move sample from A0 voice 1, slot 1 to B5 voice 3, slot 3",
        );
      });

      it("handles same kit names", () => {
        const action: MoveSampleBetweenKitsAction = {
          data: {
            affectedSamples: [],
            fromKit: "DrumKit",
            fromSlot: 5,
            fromVoice: 2,
            mode: "insert",
            movedSample: mockSample,
            toKit: "DrumKit",
            toSlot: 0,
            toVoice: 4,
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "MOVE_SAMPLE_BETWEEN_KITS",
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo move sample from DrumKit voice 2, slot 6 to DrumKit voice 4, slot 1",
        );
      });
    });

    describe("REINDEX_SAMPLES action", () => {
      it("returns correct description for reindex samples action", () => {
        const action: ReindexSamplesAction = {
          data: {
            affectedSamples: [],
            deletedSample: mockSample,
            deletedSlot: 1,
            voice: 2,
            voicesBefore: [],
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "REINDEX_SAMPLES",
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo reindex samples in voice 2 after deleting slot 2",
        );
      });

      it("handles different voice and slot numbers", () => {
        const action: ReindexSamplesAction = {
          data: {
            affectedSamples: [],
            deletedSample: mockSample,
            deletedSlot: 9,
            voice: 4,
            voicesBefore: [],
          },
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "REINDEX_SAMPLES",
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo reindex samples in voice 4 after deleting slot 10",
        );
      });
    });

    describe("default case", () => {
      it("returns default description for unknown action type", () => {
        const unknownAction = {
          data: {},
          description: "Test action",
          id: "test-id",
          timestamp: new Date(),
          type: "UNKNOWN_ACTION" as unknown,
        } as AnyUndoAction;

        const description = getActionDescription(unknownAction);

        expect(description).toBe("Undo last action");
      });
    });
  });

  describe("Type definitions", () => {
    it("allows creating valid AddSampleAction", () => {
      const action: AddSampleAction = {
        data: {
          addedSample: {
            filename: "kick.wav",
            source_path: "/path/to/kick.wav",
          },
          slot: 0,
          voice: 1,
        },
        description: "Add sample test",
        id: "test-id",
        timestamp: new Date(),
        type: "ADD_SAMPLE",
      };

      expect(action.type).toBe("ADD_SAMPLE");
      expect(action.data.voice).toBe(1);
      expect(action.data.addedSample.filename).toBe("kick.wav");
    });

    it("allows creating valid MoveSampleAction with optional fields", () => {
      const action: MoveSampleAction = {
        data: {
          affectedSamples: [
            {
              newSlot: 2,
              oldSlot: 1,
              sample: mockSample,
              voice: 2,
            },
          ],
          fromSlot: 0,
          fromVoice: 1,
          mode: "insert",
          movedSample: mockSample,
          toSlot: 1,
          toVoice: 2,
          voicesBefore: [{ samples: [], voice: 2 }],
        },
        description: "Move sample test",
        id: "test-id",
        timestamp: new Date(),
        type: "MOVE_SAMPLE",
      };

      expect(action.data.voicesBefore).toBeDefined();
      expect(action.data.affectedSamples).toHaveLength(1);
    });

    it("AnyUndoAction union type accepts all action types", () => {
      const actions: AnyUndoAction[] = [
        {
          data: { addedSample: mockSample, slot: 0, voice: 1 },
          description: "test",
          id: "1",
          timestamp: new Date(),
          type: "ADD_SAMPLE",
        } as AddSampleAction,
        {
          data: { deletedSample: mockSample, slot: 0, voice: 1 },
          description: "test",
          id: "2",
          timestamp: new Date(),
          type: "DELETE_SAMPLE",
        } as DeleteSampleAction,
        {
          data: {
            affectedSamples: [],
            deletedSample: mockSample,
            deletedSlot: 0,
            voice: 1,
            voicesBefore: [],
          },
          description: "test",
          id: "3",
          timestamp: new Date(),
          type: "REINDEX_SAMPLES",
        } as ReindexSamplesAction,
      ];

      expect(actions).toHaveLength(3);
      expect(actions[0].type).toBe("ADD_SAMPLE");
      expect(actions[1].type).toBe("DELETE_SAMPLE");
      expect(actions[2].type).toBe("REINDEX_SAMPLES");
    });
  });

  describe("slot number conversion", () => {
    it("correctly converts 0-based slot indices to 1-based slot numbers", () => {
      const action: AddSampleAction = {
        data: {
          addedSample: mockSample,
          slot: 0, // 0-based
          voice: 1,
        },
        description: "Test",
        id: "test-id",
        timestamp: new Date(),
        type: "ADD_SAMPLE",
      };

      const description = getActionDescription(action);

      // Should show slot 1 (1-based) in the description
      expect(description).toContain("slot 1");
    });

    it("correctly converts higher slot indices", () => {
      const action: MoveSampleAction = {
        data: {
          affectedSamples: [],
          fromSlot: 15, // 0-based
          fromVoice: 1,
          mode: "insert",
          movedSample: mockSample,
          toSlot: 7, // 0-based
          toVoice: 2,
          voicesBefore: [],
        },
        description: "Test",
        id: "test-id",
        timestamp: new Date(),
        type: "MOVE_SAMPLE",
      };

      const description = getActionDescription(action);

      // Should show slot 16 and slot 8 (1-based) in the description
      expect(description).toContain("slot 16");
      expect(description).toContain("slot 8");
    });
  });
});
