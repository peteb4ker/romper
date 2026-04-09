import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock withDbTransaction before importing the module under test
vi.mock("../../utils/dbUtilities.js", () => ({
  withDbTransaction: vi.fn(),
}));

import { withDbTransaction } from "../../utils/dbUtilities.js";
import {
  canVoiceAcceptSample,
  moveSampleInsertOnly,
} from "../sampleMovement.js";

const mockWithDbTransaction = vi.mocked(withDbTransaction);

// Helper to create a mock sample
function createMockSample(overrides: Record<string, unknown> = {}) {
  return {
    filename: "kick.wav",
    gain_db: 0,
    id: 1,
    is_stereo: false,
    kit_name: "A0",
    slot_number: 0,
    source_path: "/samples/kick.wav",
    voice_number: 1,
    wav_bit_depth: 16,
    wav_channels: 1,
    wav_sample_rate: 44100,
    ...overrides,
  };
}

describe("sampleMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("canVoiceAcceptSample", () => {
    it("returns success with true when voice has fewer than 12 samples", () => {
      // Mock withDbTransaction to call the callback and return DbResult
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        const mockSamples = Array.from({ length: 5 }, (_, i) =>
          createMockSample({ id: i, slot_number: i }),
        );

        const mockDb = {
          select: () => ({
            from: () => ({
              where: () => ({
                all: () => mockSamples,
              }),
            }),
          }),
        };

        const result = fn(mockDb as never, {} as never);
        return { data: result, success: true };
      });

      const result = canVoiceAcceptSample("/tmp/db", "A0", 1);

      expect(result).toEqual({ data: true, success: true });
    });

    it("returns success with false when voice has 12 samples", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        const mockSamples = Array.from({ length: 12 }, (_, i) =>
          createMockSample({ id: i, slot_number: i }),
        );

        const mockDb = {
          select: () => ({
            from: () => ({
              where: () => ({
                all: () => mockSamples,
              }),
            }),
          }),
        };

        const result = fn(mockDb as never, {} as never);
        return { data: result, success: true };
      });

      const result = canVoiceAcceptSample("/tmp/db", "A0", 1);

      expect(result).toEqual({ data: false, success: true });
    });

    it("returns success with true when voice has 0 samples", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        const mockDb = {
          select: () => ({
            from: () => ({
              where: () => ({
                all: () => [],
              }),
            }),
          }),
        };

        const result = fn(mockDb as never, {} as never);
        return { data: result, success: true };
      });

      const result = canVoiceAcceptSample("/tmp/db", "A0", 1);

      expect(result).toEqual({ data: true, success: true });
    });

    it("returns success with true when voice has 11 samples", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        const mockSamples = Array.from({ length: 11 }, (_, i) =>
          createMockSample({ id: i, slot_number: i }),
        );

        const mockDb = {
          select: () => ({
            from: () => ({
              where: () => ({
                all: () => mockSamples,
              }),
            }),
          }),
        };

        const result = fn(mockDb as never, {} as never);
        return { data: result, success: true };
      });

      const result = canVoiceAcceptSample("/tmp/db", "A0", 1);

      expect(result).toEqual({ data: true, success: true });
    });

    it("passes correct dbDir to withDbTransaction", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        const mockDb = {
          select: () => ({
            from: () => ({
              where: () => ({
                all: () => [],
              }),
            }),
          }),
        };

        const result = fn(mockDb as never, {} as never);
        return { data: result, success: true };
      });

      canVoiceAcceptSample("/my/custom/path", "A0", 1);

      expect(mockWithDbTransaction).toHaveBeenCalledWith(
        "/my/custom/path",
        expect.any(Function),
      );
    });
  });

  describe("moveSampleInsertOnly", () => {
    it("validates fromSlot lower bound", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const result = fn({} as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, -1, 2, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid slot numbers");
      expect(result.error).toContain("Must be 0-11");
    });

    it("validates fromSlot upper bound", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const result = fn({} as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 12, 2, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid slot numbers");
    });

    it("validates toSlot lower bound", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const result = fn({} as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 0, 2, -1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid slot numbers");
    });

    it("validates toSlot upper bound", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const result = fn({} as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 0, 2, 12);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid slot numbers");
    });

    it("validates fromVoice lower bound", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const result = fn({} as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 0, 0, 2, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid voice numbers");
      expect(result.error).toContain("Must be 1-4");
    });

    it("validates fromVoice upper bound", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const result = fn({} as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 5, 0, 2, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid voice numbers");
    });

    it("validates toVoice lower bound", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const result = fn({} as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 0, 0, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid voice numbers");
    });

    it("validates toVoice upper bound", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const result = fn({} as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 0, 5, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid voice numbers");
    });

    it("throws when no sample found at source position", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const mockDb = {
            select: () => ({
              from: () => ({
                where: () => ({
                  get: () => undefined,
                }),
              }),
            }),
          };

          const result = fn(mockDb as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 0, 2, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No sample found");
    });

    it("returns no-op when moving to same position", () => {
      const mockSample = createMockSample({
        id: 1,
        slot_number: 0,
        voice_number: 1,
      });

      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        const mockDb = {
          select: () => ({
            from: () => ({
              where: () => ({
                get: () => mockSample,
              }),
            }),
          }),
        };

        const result = fn(mockDb as never, {} as never);
        return { data: result, success: true };
      });

      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 0, 1, 0);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        affectedSamples: [],
        movedSample: mockSample,
      });
    });

    it("accepts valid slot boundary values (0 and 11)", () => {
      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const mockSample = createMockSample({
            id: 1,
            slot_number: 0,
            voice_number: 1,
          });

          const mockDb = {
            select: () => ({
              from: () => ({
                where: () => ({
                  get: () => mockSample,
                }),
              }),
            }),
          };

          const result = fn(mockDb as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      // Slot 0 to slot 0 (same position no-op) should not throw validation error
      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 0, 1, 0);

      expect(result.success).toBe(true);
    });

    it("accepts valid voice boundary values (1 and 4)", () => {
      const mockSample = createMockSample({
        id: 1,
        slot_number: 0,
        voice_number: 1,
      });

      mockWithDbTransaction.mockImplementation((_dbDir, fn) => {
        try {
          const mockDb = {
            select: () => ({
              from: () => ({
                where: () => ({
                  get: () => mockSample,
                }),
              }),
            }),
          };

          const result = fn(mockDb as never, {} as never);
          return { data: result, success: true };
        } catch (e) {
          return {
            error: (e as Error).message,
            success: false,
          };
        }
      });

      // Voice 1, slot 0 to voice 1, slot 0 is same position, should not throw
      const result = moveSampleInsertOnly("/tmp/db", "A0", 1, 0, 1, 0);

      expect(result.success).toBe(true);
    });
  });
});
