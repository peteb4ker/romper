// Test suite for kitStepSequencerWorker
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the global self object and create a worker-like environment
const mockSelf = {
  onmessage: null as ((e: MessageEvent) => void) | null,
  postMessage: vi.fn(),
  // Add other worker globals if needed
};

// Mock setInterval and clearInterval for precise timing control
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

// Override global functions for the worker environment
global.self = mockSelf as any;
global.setInterval = mockSetInterval;
global.clearInterval = mockClearInterval;

describe("kitStepSequencerWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the worker state by re-importing the worker
    vi.resetModules();

    // Mock timer functions to return predictable IDs
    mockSetInterval.mockImplementation(
      (callback: () => void, _delay: number) => {
        const id = Math.random();
        // Immediately call the callback for testing purposes
        setTimeout(callback, 0);
        return id;
      },
    );

    mockClearInterval.mockImplementation(() => {});
  });

  it("initializes worker with correct message handler", async () => {
    // Import the worker module to initialize the message handler
    await import("../kitStepSequencerWorker");

    expect(mockSelf.onmessage).toBeInstanceOf(Function);
  });

  describe("START message handling", () => {
    it("starts step sequencer with default parameters", async () => {
      await import("../kitStepSequencerWorker");

      const startMessage = {
        data: {
          payload: {},
          type: "START",
        },
      } as MessageEvent;

      // Send START message
      mockSelf.onmessage!(startMessage);

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        125, // default step duration
      );
    });

    it("starts step sequencer with custom parameters", async () => {
      await import("../kitStepSequencerWorker");

      const startMessage = {
        data: {
          payload: {
            numSteps: 8,
            stepDuration: 200,
          },
          type: "START",
        },
      } as MessageEvent;

      // Send START message
      mockSelf.onmessage!(startMessage);

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        200, // custom step duration
      );
    });

    it("clears existing interval before starting new one", async () => {
      await import("../kitStepSequencerWorker");

      const startMessage1 = {
        data: {
          payload: { stepDuration: 100 },
          type: "START",
        },
      } as MessageEvent;

      const startMessage2 = {
        data: {
          payload: { stepDuration: 200 },
          type: "START",
        },
      } as MessageEvent;

      // Send first START message
      mockSelf.onmessage!(startMessage1);
      expect(mockSetInterval).toHaveBeenCalledTimes(1);

      // Send second START message
      mockSelf.onmessage!(startMessage2);

      expect(mockClearInterval).toHaveBeenCalledTimes(1);
      expect(mockSetInterval).toHaveBeenCalledTimes(2);
      expect(mockSetInterval).toHaveBeenLastCalledWith(
        expect.any(Function),
        200,
      );
    });

    it("posts STEP messages during playback", async () => {
      // Mock setInterval to allow manual control over timing
      let intervalCallback: (() => void) | null = null;
      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = callback;
          return 1;
        },
      );

      await import("../kitStepSequencerWorker");

      const startMessage = {
        data: {
          payload: { numSteps: 4 },
          type: "START",
        },
      } as MessageEvent;

      // Send START message
      mockSelf.onmessage!(startMessage);

      // Manually trigger interval callbacks to simulate steps
      expect(intervalCallback).toBeDefined();

      // First step
      intervalCallback!();
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 1 },
        type: "STEP",
      });

      // Second step
      intervalCallback!();
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 2 },
        type: "STEP",
      });

      // Third step
      intervalCallback!();
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 3 },
        type: "STEP",
      });

      // Fourth step (should wrap back to 0)
      intervalCallback!();
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 0 },
        type: "STEP",
      });
    });

    it("wraps around steps correctly with custom numSteps", async () => {
      let intervalCallback: (() => void) | null = null;
      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = callback;
          return 1;
        },
      );

      await import("../kitStepSequencerWorker");

      const startMessage = {
        data: {
          payload: { numSteps: 3 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage);

      // Step through the sequence
      intervalCallback!(); // Step 1
      intervalCallback!(); // Step 2
      intervalCallback!(); // Step 0 (wrap around)
      intervalCallback!(); // Step 1 again

      const calls = mockSelf.postMessage.mock.calls;
      // Account for any initial calls and find the sequence we care about
      const stepCalls = calls.filter((call) => call[0].type === "STEP");
      expect(stepCalls.length).toBeGreaterThanOrEqual(4);

      // Check the pattern regardless of exact indices
      const steps = stepCalls.map((call) => call[0].payload.currentStep);
      expect(steps).toContain(1);
      expect(steps).toContain(2);
      expect(steps).toContain(0); // Should wrap around
    });
  });

  describe("STOP message handling", () => {
    it("stops the sequencer and resets current step", async () => {
      let intervalCallback: (() => void) | null = null;
      let intervalId: null | number = null;

      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = callback;
          intervalId = 123;
          return intervalId;
        },
      );

      await import("../kitStepSequencerWorker");

      // Start the sequencer
      const startMessage = {
        data: {
          payload: { numSteps: 8 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage);

      // Advance a few steps
      intervalCallback!(); // Step 1
      intervalCallback!(); // Step 2

      // Stop the sequencer
      const stopMessage = {
        data: {
          payload: {},
          type: "STOP",
        },
      } as MessageEvent;

      mockSelf.onmessage!(stopMessage);

      expect(mockClearInterval).toHaveBeenCalledWith(intervalId);
      expect(mockSelf.postMessage).toHaveBeenLastCalledWith({
        payload: { currentStep: 0 },
        type: "STEP",
      });
    });

    it("does not post STEP messages after stopping", async () => {
      let intervalCallback: (() => void) | null = null;
      let isPlaying = true;

      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = () => {
            if (isPlaying) {
              callback();
            }
          };
          return 1;
        },
      );

      await import("../kitStepSequencerWorker");

      // Start the sequencer
      const startMessage = {
        data: {
          payload: {},
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage);

      // Clear previous calls
      mockSelf.postMessage.mockClear();

      // Stop the sequencer
      const stopMessage = {
        data: {
          payload: {},
          type: "STOP",
        },
      } as MessageEvent;

      mockSelf.onmessage!(stopMessage);
      isPlaying = false;

      // Simulate interval callback after stopping
      intervalCallback!();

      // Should only have the reset step message, not a new step message
      expect(mockSelf.postMessage).toHaveBeenCalledTimes(1);
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 0 },
        type: "STEP",
      });
    });
  });

  describe("SET_STEP message handling", () => {
    it("sets the current step without starting playback", async () => {
      await import("../kitStepSequencerWorker");

      const setStepMessage = {
        data: {
          payload: { currentStep: 5 },
          type: "SET_STEP",
        },
      } as MessageEvent;

      mockSelf.onmessage!(setStepMessage);

      // Should not start interval
      expect(mockSetInterval).not.toHaveBeenCalled();

      // If we then start the sequencer, it should continue from step 5
      let intervalCallback: (() => void) | null = null;
      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = callback;
          return 1;
        },
      );

      const startMessage = {
        data: {
          payload: { numSteps: 8 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage);

      // Next step should be 6 (5 + 1)
      intervalCallback!();
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 6 },
        type: "STEP",
      });
    });

    it("allows setting step to 0", async () => {
      await import("../kitStepSequencerWorker");

      const setStepMessage = {
        data: {
          payload: { currentStep: 0 },
          type: "SET_STEP",
        },
      } as MessageEvent;

      mockSelf.onmessage!(setStepMessage);

      let intervalCallback: (() => void) | null = null;
      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = callback;
          return 1;
        },
      );

      const startMessage = {
        data: {
          payload: { numSteps: 4 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage);

      // Next step should be 1 (0 + 1)
      intervalCallback!();
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 1 },
        type: "STEP",
      });
    });

    it("handles step values at sequence boundaries", async () => {
      await import("../kitStepSequencerWorker");

      // Set step to last step in sequence
      const setStepMessage = {
        data: {
          payload: { currentStep: 15 }, // Last step in 16-step sequence
          type: "SET_STEP",
        },
      } as MessageEvent;

      mockSelf.onmessage!(setStepMessage);

      let intervalCallback: (() => void) | null = null;
      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = callback;
          return 1;
        },
      );

      const startMessage = {
        data: {
          payload: { numSteps: 16 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage);

      // Next step should wrap to 0 (15 + 1) % 16
      intervalCallback!();
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 0 },
        type: "STEP",
      });
    });
  });

  describe("unknown message handling", () => {
    it("ignores unknown message types", async () => {
      await import("../kitStepSequencerWorker");

      const unknownMessage = {
        data: {
          payload: { someData: "test" },
          type: "UNKNOWN",
        },
      } as MessageEvent;

      // Should not throw error
      expect(() => mockSelf.onmessage!(unknownMessage)).not.toThrow();

      // Should not start any intervals
      expect(mockSetInterval).not.toHaveBeenCalled();
      expect(mockSelf.postMessage).not.toHaveBeenCalled();
    });

    it("handles malformed messages gracefully", async () => {
      await import("../kitStepSequencerWorker");

      const malformedMessage = {
        data: null,
      } as any;

      // Should not throw error
      expect(() => mockSelf.onmessage!(malformedMessage)).not.toThrow();

      // Should not start any intervals or post messages
      expect(mockSetInterval).not.toHaveBeenCalled();
      expect(mockSelf.postMessage).not.toHaveBeenCalled();
    });

    it("handles messages without payload", async () => {
      await import("../kitStepSequencerWorker");

      const messageWithoutPayload = {
        data: {
          type: "START",
          // No payload property
        },
      } as any;

      // Should use default values and not crash
      expect(() => mockSelf.onmessage!(messageWithoutPayload)).not.toThrow();

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        125, // default step duration
      );
    });

    it("handles SET_STEP with missing currentStep value", async () => {
      await import("../kitStepSequencerWorker");

      const setStepMessage = {
        data: {
          payload: {}, // No currentStep property
          type: "SET_STEP",
        },
      } as MessageEvent;

      // Should not crash and default to 0
      expect(() => mockSelf.onmessage!(setStepMessage)).not.toThrow();
    });
  });

  describe("timing and intervals", () => {
    it("uses correct interval ID for cleanup", async () => {
      const intervalId1 = 111;
      const intervalId2 = 222;

      mockSetInterval
        .mockReturnValueOnce(intervalId1)
        .mockReturnValueOnce(intervalId2);

      await import("../kitStepSequencerWorker");

      // Start first sequencer
      const startMessage1 = {
        data: {
          payload: { stepDuration: 100 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage1);

      // Start second sequencer (should clear first)
      const startMessage2 = {
        data: {
          payload: { stepDuration: 200 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage2);

      expect(mockClearInterval).toHaveBeenCalledWith(intervalId1);

      // Stop sequencer (should clear second)
      const stopMessage = {
        data: {
          payload: {},
          type: "STOP",
        },
      } as MessageEvent;

      mockSelf.onmessage!(stopMessage);

      expect(mockClearInterval).toHaveBeenCalledWith(intervalId2);
    });

    it("handles null interval gracefully during stop", async () => {
      await import("../kitStepSequencerWorker");

      // Stop without starting (interval should be null)
      const stopMessage = {
        data: {
          payload: {},
          type: "STOP",
        },
      } as MessageEvent;

      // Should not crash
      expect(() => mockSelf.onmessage!(stopMessage)).not.toThrow();

      // Should still post reset step message
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 0 },
        type: "STEP",
      });
    });
  });

  describe("state management", () => {
    it("maintains correct step sequence across start/stop cycles", async () => {
      let intervalCallback: (() => void) | null = null;
      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = callback;
          return 1;
        },
      );

      await import("../kitStepSequencerWorker");

      // Start sequencer
      const startMessage = {
        data: {
          payload: { numSteps: 4 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage);

      // Advance a few steps
      intervalCallback!(); // Step 1
      intervalCallback!(); // Step 2

      // Stop
      const stopMessage = {
        data: {
          payload: {},
          type: "STOP",
        },
      } as MessageEvent;

      mockSelf.onmessage!(stopMessage);

      // Clear mock calls from stop
      mockSelf.postMessage.mockClear();

      // Start again (should reset to step 0)
      mockSelf.onmessage!(startMessage);

      // First step after restart should be 1
      intervalCallback!();
      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        payload: { currentStep: 1 },
        type: "STEP",
      });
    });

    it("preserves numSteps setting across multiple operations", async () => {
      let intervalCallback: (() => void) | null = null;
      mockSetInterval.mockImplementation(
        (callback: () => void, _delay: number) => {
          intervalCallback = callback;
          return 1;
        },
      );

      await import("../kitStepSequencerWorker");

      // Start with 3 steps
      const startMessage = {
        data: {
          payload: { numSteps: 3 },
          type: "START",
        },
      } as MessageEvent;

      mockSelf.onmessage!(startMessage);

      // Step to the boundary
      intervalCallback!(); // Step 1
      intervalCallback!(); // Step 2
      intervalCallback!(); // Step 0 (wrap)

      expect(mockSelf.postMessage).toHaveBeenLastCalledWith({
        payload: { currentStep: 0 },
        type: "STEP",
      });

      // Set step manually
      const setStepMessage = {
        data: {
          payload: { currentStep: 2 },
          type: "SET_STEP",
        },
      } as MessageEvent;

      mockSelf.onmessage!(setStepMessage);

      // Next step should still respect numSteps=3
      intervalCallback!(); // Should wrap to 0
      expect(mockSelf.postMessage).toHaveBeenLastCalledWith({
        payload: { currentStep: 0 },
        type: "STEP",
      });
    });
  });
});
