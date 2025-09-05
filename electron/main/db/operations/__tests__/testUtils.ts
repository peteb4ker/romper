import { vi } from "vitest";

/**
 * Creates a mock for database batch queries that return results in sequence
 * Useful for testing functions that make multiple db.select() calls
 *
 * @param queryResults Array of results to return for each sequential query
 * @returns Mock function that can be used as db.select
 */
export function createBatchQueryMock(queryResults: unknown[]) {
  let callIndex = 0;

  return vi.fn().mockImplementation(() => {
    const currentResult = queryResults[callIndex++] || [];

    return {
      from: vi.fn().mockReturnValue({
        // For simple queries with just all() (e.g., all banks)
        all: vi.fn().mockReturnValue(currentResult),
        // For queries with where + all (e.g., favorite kits)
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue(currentResult),
          // For queries with where + orderBy + all (e.g., voices, samples)
          orderBy: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue(currentResult),
          }),
        }),
      }),
    };
  });
}

/**
 * Creates a mock for single-query database operations
 * Useful for testing functions that make one db.select() call
 *
 * @param result The result to return from the query
 * @returns Mock function that can be used as db.select
 */
export function createSingleQueryMock(result: unknown) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue(result),
      get: vi.fn().mockReturnValue(result),
      where: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue(result),
        get: vi.fn().mockReturnValue(result),
      }),
    }),
  });
}

/**
 * Creates a withDb mock implementation for testing
 *
 * @param mockSelect The mock select function (from createBatchQueryMock or createSingleQueryMock)
 * @returns Mock implementation function for withDb
 */
export function createWithDbMock(mockSelect: ReturnType<typeof vi.fn>) {
  return (dbDir: string, fn: (db: unknown) => unknown) => {
    const mockDb = {
      select: mockSelect,
    };
    return fn(mockDb);
  };
}
