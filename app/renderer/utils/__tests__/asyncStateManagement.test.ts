import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createInitialAsyncState,
  useAsyncOperation,
  useAsyncState,
  useDebouncedAsyncOperation,
  useOptimisticMutation,
} from "../asyncStateManagement";

describe("Async State Management - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createInitialAsyncState", () => {
    test("should create initial state with correct structure", () => {
      const initialState = createInitialAsyncState("test data");

      expect(initialState).toEqual({
        data: "test data",
        error: null,
        lastUpdated: null,
        loading: false,
      });
    });

    test("should handle different data types", () => {
      const arrayState = createInitialAsyncState([1, 2, 3]);
      const objectState = createInitialAsyncState({ key: "value" });
      const numberState = createInitialAsyncState(42);

      expect(arrayState.data).toEqual([1, 2, 3]);
      expect(objectState.data).toEqual({ key: "value" });
      expect(numberState.data).toBe(42);
    });
  });

  describe("useAsyncState", () => {
    test("should initialize with correct state", () => {
      const { result } = renderHook(() => useAsyncState("initial data"));
      const [state] = result.current;

      expect(state).toEqual({
        data: "initial data",
        error: null,
        lastUpdated: null,
        loading: false,
      });
    });

    test("should provide working actions", () => {
      const { result } = renderHook(() => useAsyncState("initial data"));
      const [, actions] = result.current;

      expect(typeof actions.setLoading).toBe("function");
      expect(typeof actions.setData).toBe("function");
      expect(typeof actions.setError).toBe("function");
      expect(typeof actions.reset).toBe("function");
      expect(typeof actions.update).toBe("function");
    });

    test("should set loading state", () => {
      const { result } = renderHook(() => useAsyncState("initial data"));

      act(() => {
        result.current[1].setLoading(true);
      });

      expect(result.current[0].loading).toBe(true);
    });

    test("should set data with timestamp", () => {
      const { result } = renderHook(() => useAsyncState("initial data"));

      act(() => {
        result.current[1].setData("new data");
      });

      expect(result.current[0].data).toBe("new data");
      expect(result.current[0].loading).toBe(false);
      expect(result.current[0].error).toBeNull();
      expect(result.current[0].lastUpdated).toBeTypeOf("number");
    });

    test("should set error", () => {
      const { result } = renderHook(() => useAsyncState("initial data"));

      act(() => {
        result.current[1].setError("Test error");
      });

      expect(result.current[0].error).toBe("Test error");
      expect(result.current[0].loading).toBe(false);
    });

    test("should reset to initial state", () => {
      const { result } = renderHook(() => useAsyncState("initial data"));

      // Modify state
      act(() => {
        result.current[1].setData("modified data");
        result.current[1].setError("Test error");
        result.current[1].setLoading(true);
      });

      // Reset
      act(() => {
        result.current[1].reset();
      });

      expect(result.current[0]).toEqual({
        data: "initial data",
        error: null,
        lastUpdated: null,
        loading: false,
      });
    });

    test("should update data with updater function", () => {
      const { result } = renderHook(() => useAsyncState([1, 2, 3]));

      act(() => {
        result.current[1].update((prev) => [...prev, 4]);
      });

      expect(result.current[0].data).toEqual([1, 2, 3, 4]);
      expect(result.current[0].lastUpdated).toBeTypeOf("number");
    });

    test("should handle debounced data updates", () => {
      const { result } = renderHook(() =>
        useAsyncState("initial", { debounceMs: 100 }),
      );

      act(() => {
        result.current[1].setData("first update");
        result.current[1].setData("second update");
        result.current[1].setData("third update");
      });

      // Data shouldn't update immediately
      expect(result.current[0].data).toBe("initial");

      // Advance timers
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Now data should be updated to the last value
      expect(result.current[0].data).toBe("third update");
    });

    test("should reset on mount when requested", () => {
      const { rerender, result } = renderHook(
        (resetOnMount: boolean) => useAsyncState("initial", { resetOnMount }),
        { initialProps: false },
      );

      // Modify state
      act(() => {
        result.current[1].setData("modified");
      });

      expect(result.current[0].data).toBe("modified");

      // Rerender with resetOnMount: true
      rerender(true);

      expect(result.current[0].data).toBe("initial");
    });
  });

  describe("useAsyncOperation", () => {
    test("should execute operation successfully", async () => {
      const mockOperation = vi.fn().mockResolvedValue("success result");
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      expect(result.current.state.data).toBeNull();
      expect(result.current.state.loading).toBe(false);

      let executePromise: Promise<unknown>;
      act(() => {
        executePromise = result.current.execute("arg1", "arg2");
      });

      // Wait for operation to complete
      const resultValue = await act(async () => {
        return await executePromise!;
      });

      expect(resultValue).toBe("success result");
      expect(mockOperation).toHaveBeenCalledWith("arg1", "arg2");
      expect(result.current.state.data).toBe("success result");
      expect(result.current.state.loading).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    test("should handle operation errors", async () => {
      const error = new Error("Operation failed");
      const mockOperation = vi.fn().mockRejectedValue(error);
      const { result } = renderHook(() => useAsyncOperation(mockOperation));

      let executePromise: Promise<unknown>;
      act(() => {
        executePromise = result.current.execute();
      });

      // Wait for operation to fail and handle the expected rejection
      await act(async () => {
        try {
          await executePromise!;
        } catch {
          // Expected error - do nothing
        }
      });

      expect(result.current.state.data).toBeNull();
      expect(result.current.state.loading).toBe(false);
      expect(result.current.state.error).toBe("Operation failed");
    });
  });

  describe("useOptimisticMutation", () => {
    test("should apply optimistic updates", async () => {
      const mockMutation = vi.fn().mockResolvedValue("final result");
      const optimisticUpdate = vi.fn((current, newValue) => newValue);

      const { result } = renderHook(() =>
        useOptimisticMutation("initial data", mockMutation, {
          optimisticUpdate,
        }),
      );

      expect(result.current.data).toBe("initial data");

      let mutatePromise: Promise<void>;
      act(() => {
        mutatePromise = result.current.mutate("optimistic data");
      });

      // Should apply optimistic update immediately
      expect(result.current.data).toBe("optimistic data");
      expect(result.current.loading).toBe(true);
      expect(optimisticUpdate).toHaveBeenCalledWith(
        "initial data",
        "optimistic data",
      );

      // Wait for mutation to complete
      await act(async () => {
        await mutatePromise!;
      });

      // Should update to final result
      expect(result.current.data).toBe("final result");
      expect(result.current.loading).toBe(false);
      expect(mockMutation).toHaveBeenCalledWith("optimistic data");
    });

    test("should rollback optimistic updates on error", async () => {
      const error = new Error("Mutation failed");
      const mockMutation = vi.fn().mockRejectedValue(error);
      const optimisticUpdate = vi.fn((current, newValue) => newValue);
      const onError = vi.fn();

      const { result } = renderHook(() =>
        useOptimisticMutation("initial data", mockMutation, {
          onError,
          optimisticUpdate,
        }),
      );

      let mutatePromise: Promise<void>;
      act(() => {
        mutatePromise = result.current.mutate("optimistic data");
      });

      // Should apply optimistic update
      expect(result.current.data).toBe("optimistic data");

      // Wait for mutation to fail
      await act(async () => {
        await mutatePromise!;
      });

      // Should rollback to original data
      expect(result.current.data).toBe("initial data");
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("Mutation failed");
      expect(onError).toHaveBeenCalledWith(error, "initial data");
    });

    test("should call onSuccess callback", async () => {
      const mockMutation = vi.fn().mockResolvedValue("success result");
      const onSuccess = vi.fn();

      const { result } = renderHook(() =>
        useOptimisticMutation("initial data", mockMutation, {
          onSuccess,
        }),
      );

      let mutatePromise: Promise<void>;
      act(() => {
        mutatePromise = result.current.mutate("arg");
      });

      await act(async () => {
        await mutatePromise!;
      });

      expect(onSuccess).toHaveBeenCalledWith("success result");
    });

    test("should update data when external data changes", () => {
      const mockMutation = vi.fn();
      const { rerender, result } = renderHook(
        (data: string) => useOptimisticMutation(data, mockMutation),
        { initialProps: "initial" },
      );

      expect(result.current.data).toBe("initial");

      // Change external data
      rerender("external update");

      expect(result.current.data).toBe("external update");
    });
  });

  describe("useDebouncedAsyncOperation", () => {
    test("should debounce operation execution", async () => {
      const mockOperation = vi.fn().mockResolvedValue("result");
      const { result } = renderHook(() =>
        useDebouncedAsyncOperation(mockOperation, 100),
      );

      // Call execute multiple times quickly within act
      let promise1: Promise<unknown>,
        promise2: Promise<unknown>,
        promise3: Promise<unknown>;
      act(() => {
        promise1 = result.current.execute("arg1");
        promise2 = result.current.execute("arg2");
        promise3 = result.current.execute("arg3");
      });

      expect(mockOperation).not.toHaveBeenCalled();

      // Advance timers to trigger debounced operation
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should only execute the last operation
      await act(async () => {
        await Promise.allSettled([promise1!, promise2!, promise3!]);
      });

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(mockOperation).toHaveBeenCalledWith("arg3");
      expect(result.current.loading).toBe(false);
    });

    test("should cancel pending operations", async () => {
      const mockOperation = vi.fn().mockResolvedValue("result");
      const { result } = renderHook(() =>
        useDebouncedAsyncOperation(mockOperation, 100),
      );

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.execute("arg1");
      });

      // Cancel the operation
      act(() => {
        result.current.cancel();
      });

      expect(result.current.loading).toBe(false);

      // Advance timers
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Handle the cancelled promise to avoid unhandled rejection
      await act(async () => {
        try {
          await promise!;
        } catch {
          // Expected cancellation error - do nothing
        }
      });

      expect(mockOperation).not.toHaveBeenCalled();
    });

    test("should handle operation errors", async () => {
      const error = new Error("Debounced operation failed");
      const mockOperation = vi.fn().mockRejectedValue(error);
      const { result } = renderHook(() =>
        useDebouncedAsyncOperation(mockOperation, 100),
      );

      const promise = result.current.execute("arg");

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await expect(promise).rejects.toThrow("Debounced operation failed");
      expect(result.current.loading).toBe(false);
    });

    test("should handle cancellation during execution", async () => {
      const mockOperation = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 50)),
        );
      const { result } = renderHook(() =>
        useDebouncedAsyncOperation(mockOperation, 100),
      );

      let promise: Promise<unknown>;
      act(() => {
        promise = result.current.execute("arg");
      });

      // Start execution
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Cancel while operation is running
      act(() => {
        result.current.cancel();
      });

      await act(async () => {
        try {
          await promise!;
        } catch {
          // Expected cancellation error - do nothing
        }
      });
    });
  });
});
