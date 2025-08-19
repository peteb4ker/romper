// Tests for scanner orchestrator

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProgressCallback, ScannerFunction } from "../types";

import { ScannerOrchestrator } from "../orchestrator";

// Global mock progress callback for all tests
let mockProgressCallback: ProgressCallback;

beforeEach(() => {
  vi.clearAllMocks();
  mockProgressCallback = vi.fn();
});

describe("ScannerOrchestrator", () => {
  describe("executeChain", () => {
    it("executes operations in sequence with progress tracking", async () => {
      const orchestrator = new ScannerOrchestrator(
        mockProgressCallback,
        "continue"
      );

      const mockOperation1: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: { result: "operation1" },
          success: true,
        });

      const mockOperation2: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: { result: "operation2" },
          success: true,
        });

      const operations = [
        { input: { test: "input1" }, name: "op1", scanner: mockOperation1 },
        { input: { test: "input2" }, name: "op2", scanner: mockOperation2 },
      ];

      const result = await orchestrator.executeChain(operations);

      expect(result.success).toBe(true);
      expect(result.results).toEqual({
        op1: { result: "operation1" },
        op2: { result: "operation2" },
      });
      expect(result.errors).toEqual([]);
      expect(result.completedOperations).toBe(2);
      expect(result.totalOperations).toBe(2);

      // Check progress callbacks
      expect(mockProgressCallback).toHaveBeenCalledWith(0, 2, "op1");
      expect(mockProgressCallback).toHaveBeenCalledWith(1, 2, "op2");
      expect(mockProgressCallback).toHaveBeenCalledWith(2, 2, "Complete");
    });

    it("handles scanner failure with continue strategy", async () => {
      const orchestrator = new ScannerOrchestrator(
        mockProgressCallback,
        "continue"
      );

      const mockOperation1: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          error: "Operation 1 failed",
          success: false,
        });

      const mockOperation2: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: { result: "operation2" },
          success: true,
        });

      const operations = [
        { input: { test: "input1" }, name: "op1", scanner: mockOperation1 },
        { input: { test: "input2" }, name: "op2", scanner: mockOperation2 },
      ];

      const result = await orchestrator.executeChain(operations);

      expect(result.success).toBe(false);
      expect(result.results).toEqual({
        op2: { result: "operation2" },
      });
      expect(result.errors).toEqual([
        { error: "Operation 1 failed", operation: "op1" },
      ]);
      expect(result.completedOperations).toBe(1);
      expect(result.totalOperations).toBe(2);
    });

    it("handles scanner failure with stop strategy", async () => {
      const orchestrator = new ScannerOrchestrator(
        mockProgressCallback,
        "stop"
      );

      const mockOperation1: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          error: "Operation 1 failed",
          success: false,
        });

      const mockOperation2: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: { result: "operation2" },
          success: true,
        });

      const operations = [
        { input: { test: "input1" }, name: "op1", scanner: mockOperation1 },
        { input: { test: "input2" }, name: "op2", scanner: mockOperation2 },
      ];

      const result = await orchestrator.executeChain(operations);

      expect(result.success).toBe(false);
      expect(result.results).toEqual({});
      expect(result.errors).toEqual([
        { error: "Operation 1 failed", operation: "op1" },
      ]);
      expect(result.completedOperations).toBe(0);
      expect(result.totalOperations).toBe(2);

      // Operation 2 should not have been called
      expect(mockOperation2).not.toHaveBeenCalled();
    });

    it("handles unexpected exceptions with continue strategy", async () => {
      const orchestrator = new ScannerOrchestrator(
        mockProgressCallback,
        "continue"
      );

      const mockOperation1: ScannerFunction<any, any> = vi
        .fn()
        .mockRejectedValue(new Error("Unexpected error"));

      const mockOperation2: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: { result: "operation2" },
          success: true,
        });

      const operations = [
        { input: { test: "input1" }, name: "op1", scanner: mockOperation1 },
        { input: { test: "input2" }, name: "op2", scanner: mockOperation2 },
      ];

      const result = await orchestrator.executeChain(operations);

      expect(result.success).toBe(false);
      expect(result.results).toEqual({
        op2: { result: "operation2" },
      });
      expect(result.errors).toEqual([
        { error: "Unexpected error", operation: "op1" },
      ]);
      expect(result.completedOperations).toBe(1);
      expect(result.totalOperations).toBe(2);
    });

    it("handles unexpected exceptions with stop strategy", async () => {
      const orchestrator = new ScannerOrchestrator(
        mockProgressCallback,
        "stop"
      );

      const mockOperation1: ScannerFunction<any, any> = vi
        .fn()
        .mockRejectedValue(new Error("Unexpected error"));

      const mockOperation2: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: { result: "operation2" },
          success: true,
        });

      const operations = [
        { input: { test: "input1" }, name: "op1", scanner: mockOperation1 },
        { input: { test: "input2" }, name: "op2", scanner: mockOperation2 },
      ];

      const result = await orchestrator.executeChain(operations);

      expect(result.success).toBe(false);
      expect(result.results).toEqual({});
      expect(result.errors).toEqual([
        { error: "Unexpected error", operation: "op1" },
      ]);
      expect(result.completedOperations).toBe(0);
      expect(result.totalOperations).toBe(2);

      // Operation 2 should not have been called
      expect(mockOperation2).not.toHaveBeenCalled();
    });

    it("works without progress callback", async () => {
      const orchestrator = new ScannerOrchestrator();

      const mockOperation: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: { result: "operation" },
          success: true,
        });

      const operations = [
        { input: { test: "input" }, name: "op", scanner: mockOperation },
      ];

      const result = await orchestrator.executeChain(operations);

      expect(result.success).toBe(true);
      expect(result.results).toEqual({
        op: { result: "operation" },
      });
    });

    it("handles empty operations array", async () => {
      const orchestrator = new ScannerOrchestrator(mockProgressCallback);

      const result = await orchestrator.executeChain([]);

      expect(result.success).toBe(true);
      expect(result.results).toEqual({});
      expect(result.errors).toEqual([]);
      expect(result.completedOperations).toBe(0);
      expect(result.totalOperations).toBe(0);

      expect(mockProgressCallback).toHaveBeenCalledWith(0, 0, "Complete");
    });

    it("handles operations with undefined data", async () => {
      const orchestrator = new ScannerOrchestrator(mockProgressCallback);

      const mockOperation: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: undefined,
          success: true,
        });

      const operations = [
        { input: { test: "input" }, name: "op", scanner: mockOperation },
      ];

      const result = await orchestrator.executeChain(operations);

      expect(result.success).toBe(false);
      expect(result.results).toEqual({});
      expect(result.completedOperations).toBe(0);
      expect(result.totalOperations).toBe(1);
    });

    it("continues execution when strategy is continue and operation has no error message", async () => {
      const orchestrator = new ScannerOrchestrator(
        mockProgressCallback,
        "continue"
      );

      const mockOperation1: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          success: false,
          // No error message
        });

      const mockOperation2: ScannerFunction<any, any> = vi
        .fn()
        .mockResolvedValue({
          data: { result: "operation2" },
          success: true,
        });

      const operations = [
        { input: { test: "input1" }, name: "op1", scanner: mockOperation1 },
        { input: { test: "input2" }, name: "op2", scanner: mockOperation2 },
      ];

      const result = await orchestrator.executeChain(operations);

      expect(result.success).toBe(false);
      expect(result.results).toEqual({
        op2: { result: "operation2" },
      });
      expect(result.errors).toEqual([
        { error: "Unknown error", operation: "op1" },
      ]);
      expect(result.completedOperations).toBe(1);
      expect(result.totalOperations).toBe(2);
    });
  });
});
