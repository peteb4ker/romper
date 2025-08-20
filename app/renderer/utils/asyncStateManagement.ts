import type { DependencyList } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Enhanced async state management patterns
 * Reduces duplication and standardizes loading/error states across hooks
 */

/**
 * Standard async state structure
 */
export interface AsyncState<T> {
  data: T;
  error: null | string;
  lastUpdated: null | number;
  loading: boolean;
}

/**
 * Async state actions
 */
export interface AsyncStateActions<T> {
  reset: () => void;
  setData: (data: T) => void;
  setError: (error: null | string) => void;
  setLoading: (loading: boolean) => void;
  update: (updater: (prev: T) => T) => void;
}

/**
 * Initial state factory
 */
export function createInitialAsyncState<T>(initialData: T): AsyncState<T> {
  return {
    data: initialData,
    error: null,
    lastUpdated: null,
    loading: false,
  };
}

/**
 * Hook for managing async operations with automatic state management
 */
export function useAsyncOperation<T, Args extends any[]>(
  operation: (...args: Args) => Promise<T>,
  deps: DependencyList = [],
): {
  actions: AsyncStateActions<null | T>;
  execute: (...args: Args) => Promise<T>;
  state: AsyncState<null | T>;
} {
  const [state, actions] = useAsyncState<null | T>(null);

  const execute = useCallback(
    async (...args: Args): Promise<T> => {
      actions.setLoading(true);
      actions.setError(null);

      try {
        const result = await operation(...args);
        actions.setData(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        actions.setError(errorMessage);
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions, ...deps],
  );

  return { actions, execute, state };
}

/**
 * Enhanced useAsyncState hook with built-in patterns
 */
export function useAsyncState<T>(
  initialData: T,
  options: {
    debounceMs?: number;
    resetOnMount?: boolean;
  } = {},
): [AsyncState<T>, AsyncStateActions<T>] {
  const [state, setState] = useState<AsyncState<T>>(() =>
    createInitialAsyncState(initialData),
  );

  const initialDataRef = useRef(initialData);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Reset on mount if requested
  useEffect(() => {
    if (options.resetOnMount) {
      setState(createInitialAsyncState(initialDataRef.current));
    }
  }, [options.resetOnMount]);

  const actions: AsyncStateActions<T> = {
    reset: useCallback(() => {
      setState(createInitialAsyncState(initialDataRef.current));
    }, []),

    setData: useCallback(
      (data: T) => {
        const update = () => {
          setState((prev) => ({
            ...prev,
            data,
            error: null,
            lastUpdated: Date.now(),
            loading: false,
          }));
        };

        if (options.debounceMs) {
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }
          debounceTimeoutRef.current = setTimeout(update, options.debounceMs);
        } else {
          update();
        }
      },
      [options.debounceMs],
    ),

    setError: useCallback((error: null | string) => {
      setState((prev) => ({ ...prev, error, loading: false }));
    }, []),

    setLoading: useCallback((loading: boolean) => {
      setState((prev) => ({ ...prev, loading }));
    }, []),

    update: useCallback((updater: (prev: T) => T) => {
      setState((prev) => ({
        ...prev,
        data: updater(prev.data),
        lastUpdated: Date.now(),
      }));
    }, []),
  };

  // Cleanup debounce timeout
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return [state, actions];
}

/**
 * Hook for debounced async operations
 */
export function useDebouncedAsyncOperation<T, Args extends any[]>(
  operation: (...args: Args) => Promise<T>,
  delay: number = 300,
): {
  cancel: () => void;
  execute: (...args: Args) => Promise<T>;
  loading: boolean;
} {
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const pendingArgsRef = useRef<Args | undefined>(undefined);
  const resolveRef = useRef<((value: T) => void) | undefined>(undefined);
  const rejectRef = useRef<((error: any) => void) | undefined>(undefined);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      (timeoutRef as any).current = undefined;
    }
    if (rejectRef.current) {
      rejectRef.current(new Error("Operation cancelled"));
      (rejectRef as any).current = undefined;
      (resolveRef as any).current = undefined;
    }
    setLoading(false);
  }, []);

  const execute = useCallback(
    (...args: Args): Promise<T> => {
      return new Promise((resolve, reject) => {
        // Cancel previous operation
        cancel();

        // Store new operation
        pendingArgsRef.current = args;
        resolveRef.current = resolve;
        rejectRef.current = reject;
        setLoading(true);

        // Debounce the operation
        timeoutRef.current = setTimeout(async () => {
          try {
            const result = await operation(...args);
            if (resolveRef.current) {
              resolveRef.current(result);
            }
          } catch (error) {
            if (rejectRef.current) {
              rejectRef.current(error);
            }
          } finally {
            setLoading(false);
            (resolveRef as any).current = undefined;
            (rejectRef as any).current = undefined;
          }
        }, delay);
      });
    },
    [cancel, delay, operation],
  );

  // Cleanup on unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  return { cancel, execute, loading };
}

// Note: This function has React hook violations and should be refactored
// For now, commenting out to fix linting issues during development
// TODO: Implement proper multiple async operations pattern

/**
 * Hook for managing data mutations with optimistic updates
 */
export function useOptimisticMutation<T, Args extends any[]>(
  data: T,
  mutationFn: (...args: Args) => Promise<T>,
  options: {
    onError?: (error: unknown, previousData: T) => void;
    onSuccess?: (newData: T) => void;
    optimisticUpdate?: (current: T, ...args: Args) => T;
  } = {},
): {
  data: T;
  error: null | string;
  loading: boolean;
  mutate: (...args: Args) => Promise<void>;
} {
  const [currentData, setCurrentData] = useState(data);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const mutate = useCallback(
    async (...args: Args): Promise<void> => {
      setLoading(true);
      setError(null);

      // Apply optimistic update if provided
      let previousData = currentData;
      if (options.optimisticUpdate) {
        const optimisticData = options.optimisticUpdate(currentData, ...args);
        setCurrentData(optimisticData);
      }

      try {
        const result = await mutationFn(...args);
        setCurrentData(result);
        options.onSuccess?.(result);
      } catch (err) {
        // Rollback optimistic update on error
        setCurrentData(previousData);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        options.onError?.(err, previousData);
      } finally {
        setLoading(false);
      }
    },
    [currentData, mutationFn, options],
  );

  // Update local data when external data changes
  useEffect(() => {
    setCurrentData(data);
  }, [data]);

  return {
    data: currentData,
    error,
    loading,
    mutate,
  };
}

/**
 * Hook for managing paginated data loading
 */
export function usePaginatedAsyncData<T>(
  loadPage: (
    page: number,
    pageSize: number,
  ) => Promise<{
    data: T[];
    hasMore: boolean;
    total: number;
  }>,
  pageSize: number = 20,
): {
  currentPage: number;
  data: T[];
  error: null | string;
  hasMore: boolean;
  loading: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
  total: number;
} {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const result = await loadPage(currentPage, pageSize);

      setData((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setTotal(result.total);
      setCurrentPage((prev) => prev + 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPage, hasMore, loading, loadPage, pageSize]);

  const reset = useCallback(() => {
    setData([]);
    setCurrentPage(0);
    setHasMore(true);
    setTotal(0);
    setError(null);
  }, []);

  // Load first page on mount
  useEffect(() => {
    if (currentPage === 0 && data.length === 0 && hasMore) {
      loadMore();
    }
  }, [currentPage, data.length, hasMore, loadMore]);

  return {
    currentPage,
    data,
    error,
    hasMore,
    loading,
    loadMore,
    reset,
    total,
  };
}
