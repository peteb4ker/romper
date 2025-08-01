import { describe, expect, it, vi } from "vitest";

import {
  type AddSampleAction,
  type AnyUndoAction,
  type CompactSlotsAction,
  createActionId,
  type DeleteSampleAction,
  getActionDescription,
  type MoveSampleAction,
  type MoveSampleBetweenKitsAction,
  type ReplaceSampleAction,
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

      expect(id).toMatch(new RegExp(`^${now}-[a-z0-9]{9}$`));

      vi.restoreAllMocks();
    });

    it("generates IDs with correct format", () => {
      const id = createActionId();

      // Should match format: timestamp-randomstring
      expect(id).toMatch(/^\d+-[a-z0-9]{9}$/);
    });

    it("uses Math.random for suffix generation", () => {
      const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.123456789);
      vi.spyOn(Date, "now").mockReturnValue(1000000000000);

      const id = createActionId();

      // Should contain the substring generated from the mocked random value
      // 0.123456789.toString(36).substring(2, 11) = "4fzzzxjyl"
      expect(id).toContain("4fzzzxjyl");

      mockRandom.mockRestore();
      vi.restoreAllMocks();
    });
  });

  const mockSample = {
    filename: "test.wav",
    source_path: "/path/to/test.wav",
    is_stereo: false,
  };

  describe("getActionDescription", () => {
    describe("ADD_SAMPLE action", () => {
      it("returns correct description for add sample action", () => {
        const action: AddSampleAction = {
          id: "test-id",
          type: "ADD_SAMPLE",
          timestamp: new Date(),
          description: "Test action",
          data: {
            voice: 1,
            slot: 0,
            addedSample: mockSample,
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe("Undo add sample to voice 1, slot 1");
      });

      it("handles different voice and slot numbers", () => {
        const action: AddSampleAction = {
          id: "test-id",
          type: "ADD_SAMPLE",
          timestamp: new Date(),
          description: "Test action",
          data: {
            voice: 3,
            slot: 7,
            addedSample: mockSample,
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe("Undo add sample to voice 3, slot 8");
      });
    });

    describe("REPLACE_SAMPLE action", () => {
      it("returns correct description for replace sample action", () => {
        const action: ReplaceSampleAction = {
          id: "test-id",
          type: "REPLACE_SAMPLE",
          timestamp: new Date(),
          description: "Test action",
          data: {
            voice: 2,
            slot: 3,
            oldSample: mockSample,
            newSample: mockSample,
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe("Undo replace sample in voice 2, slot 4");
      });
    });

    describe("DELETE_SAMPLE action", () => {
      it("returns correct description for delete sample action", () => {
        const action: DeleteSampleAction = {
          id: "test-id",
          type: "DELETE_SAMPLE",
          timestamp: new Date(),
          description: "Test action",
          data: {
            voice: 4,
            slot: 1,
            deletedSample: mockSample,
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe("Undo delete sample from voice 4, slot 2");
      });
    });

    describe("MOVE_SAMPLE action", () => {
      it("returns correct description for move sample action", () => {
        const action: MoveSampleAction = {
          id: "test-id",
          type: "MOVE_SAMPLE",
          timestamp: new Date(),
          description: "Test action",
          data: {
            fromVoice: 1,
            fromSlot: 0,
            toVoice: 2,
            toSlot: 3,
            mode: "insert",
            movedSample: mockSample,
            affectedSamples: [],
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo move sample from voice 1, slot 1 to voice 2, slot 4",
        );
      });

      it("handles different move coordinates", () => {
        const action: MoveSampleAction = {
          id: "test-id",
          type: "MOVE_SAMPLE",
          timestamp: new Date(),
          description: "Test action",
          data: {
            fromVoice: 3,
            fromSlot: 7,
            toVoice: 1,
            toSlot: 2,
            mode: "overwrite",
            movedSample: mockSample,
            affectedSamples: [],
          },
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
          id: "test-id",
          type: "MOVE_SAMPLE_BETWEEN_KITS",
          timestamp: new Date(),
          description: "Test action",
          data: {
            fromKit: "A0",
            fromVoice: 1,
            fromSlot: 0,
            toKit: "B5",
            toVoice: 3,
            toSlot: 2,
            mode: "insert",
            movedSample: mockSample,
            affectedSamples: [],
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo move sample from A0 voice 1, slot 1 to B5 voice 3, slot 3",
        );
      });

      it("handles same kit names", () => {
        const action: MoveSampleBetweenKitsAction = {
          id: "test-id",
          type: "MOVE_SAMPLE_BETWEEN_KITS",
          timestamp: new Date(),
          description: "Test action",
          data: {
            fromKit: "DrumKit",
            fromVoice: 2,
            fromSlot: 5,
            toKit: "DrumKit",
            toVoice: 4,
            toSlot: 0,
            mode: "overwrite",
            movedSample: mockSample,
            affectedSamples: [],
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo move sample from DrumKit voice 2, slot 6 to DrumKit voice 4, slot 1",
        );
      });
    });

    describe("COMPACT_SLOTS action", () => {
      it("returns correct description for compact slots action", () => {
        const action: CompactSlotsAction = {
          id: "test-id",
          type: "COMPACT_SLOTS",
          timestamp: new Date(),
          description: "Test action",
          data: {
            voice: 2,
            deletedSlot: 1,
            deletedSample: mockSample,
            affectedSamples: [],
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo compact slots in voice 2 after deleting slot 2",
        );
      });

      it("handles different voice and slot numbers", () => {
        const action: CompactSlotsAction = {
          id: "test-id",
          type: "COMPACT_SLOTS",
          timestamp: new Date(),
          description: "Test action",
          data: {
            voice: 4,
            deletedSlot: 9,
            deletedSample: mockSample,
            affectedSamples: [],
          },
        };

        const description = getActionDescription(action);

        expect(description).toBe(
          "Undo compact slots in voice 4 after deleting slot 10",
        );
      });
    });

    describe("default case", () => {
      it("returns default description for unknown action type", () => {
        const unknownAction = {
          id: "test-id",
          type: "UNKNOWN_ACTION" as any,
          timestamp: new Date(),
          description: "Test action",
          data: {},
        } as AnyUndoAction;

        const description = getActionDescription(unknownAction);

        expect(description).toBe("Undo last action");
      });
    });
  });

  describe("Type definitions", () => {
    it("allows creating valid AddSampleAction", () => {
      const action: AddSampleAction = {
        id: "test-id",
        type: "ADD_SAMPLE",
        timestamp: new Date(),
        description: "Add sample test",
        data: {
          voice: 1,
          slot: 0,
          addedSample: {
            filename: "kick.wav",
            source_path: "/path/to/kick.wav",
            is_stereo: false,
          },
        },
      };

      expect(action.type).toBe("ADD_SAMPLE");
      expect(action.data.voice).toBe(1);
      expect(action.data.addedSample.filename).toBe("kick.wav");
    });

    it("allows creating valid ReplaceSampleAction", () => {
      const action: ReplaceSampleAction = {
        id: "test-id",
        type: "REPLACE_SAMPLE",
        timestamp: new Date(),
        description: "Replace sample test",
        data: {
          voice: 2,
          slot: 1,
          oldSample: {
            filename: "old.wav",
            source_path: "/path/to/old.wav",
            is_stereo: false,
          },
          newSample: {
            filename: "new.wav",
            source_path: "/path/to/new.wav",
            is_stereo: true,
          },
        },
      };

      expect(action.type).toBe("REPLACE_SAMPLE");
      expect(action.data.oldSample.filename).toBe("old.wav");
      expect(action.data.newSample.filename).toBe("new.wav");
    });

    it("allows creating valid MoveSampleAction with optional fields", () => {
      const action: MoveSampleAction = {
        id: "test-id",
        type: "MOVE_SAMPLE",
        timestamp: new Date(),
        description: "Move sample test",
        data: {
          fromVoice: 1,
          fromSlot: 0,
          toVoice: 2,
          toSlot: 1,
          mode: "overwrite",
          movedSample: mockSample,
          affectedSamples: [
            {
              voice: 2,
              oldSlot: 1,
              newSlot: 2,
              sample: mockSample,
            },
          ],
          replacedSample: mockSample,
          stateSnapshot: [
            {
              voice: 2,
              slot: 1,
              sample: mockSample,
            },
          ],
        },
      };

      expect(action.data.replacedSample).toBeDefined();
      expect(action.data.stateSnapshot).toBeDefined();
      expect(action.data.affectedSamples).toHaveLength(1);
    });

    it("AnyUndoAction union type accepts all action types", () => {
      const actions: AnyUndoAction[] = [
        {
          id: "1",
          type: "ADD_SAMPLE",
          timestamp: new Date(),
          description: "test",
          data: { voice: 1, slot: 0, addedSample: mockSample },
        } as AddSampleAction,
        {
          id: "2",
          type: "DELETE_SAMPLE",
          timestamp: new Date(),
          description: "test",
          data: { voice: 1, slot: 0, deletedSample: mockSample },
        } as DeleteSampleAction,
        {
          id: "3",
          type: "COMPACT_SLOTS",
          timestamp: new Date(),
          description: "test",
          data: {
            voice: 1,
            deletedSlot: 0,
            deletedSample: mockSample,
            affectedSamples: [],
          },
        } as CompactSlotsAction,
      ];

      expect(actions).toHaveLength(3);
      expect(actions[0].type).toBe("ADD_SAMPLE");
      expect(actions[1].type).toBe("DELETE_SAMPLE");
      expect(actions[2].type).toBe("COMPACT_SLOTS");
    });
  });

  describe("slot number conversion", () => {
    it("correctly converts 0-based slot indices to 1-based slot numbers", () => {
      const action: AddSampleAction = {
        id: "test-id",
        type: "ADD_SAMPLE",
        timestamp: new Date(),
        description: "Test",
        data: {
          voice: 1,
          slot: 0, // 0-based
          addedSample: mockSample,
        },
      };

      const description = getActionDescription(action);

      // Should show slot 1 (1-based) in the description
      expect(description).toContain("slot 1");
    });

    it("correctly converts higher slot indices", () => {
      const action: MoveSampleAction = {
        id: "test-id",
        type: "MOVE_SAMPLE",
        timestamp: new Date(),
        description: "Test",
        data: {
          fromVoice: 1,
          fromSlot: 15, // 0-based
          toVoice: 2,
          toSlot: 7, // 0-based
          mode: "insert",
          movedSample: mockSample,
          affectedSamples: [],
        },
      };

      const description = getActionDescription(action);

      // Should show slot 16 and slot 8 (1-based) in the description
      expect(description).toContain("slot 16");
      expect(description).toContain("slot 8");
    });
  });
});
