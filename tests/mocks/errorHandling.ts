import { vi } from "vitest";

/**
 * Mock implementation of error handling patterns for tests
 * Simple mocks that only handle console.error - toast is mocked separately in individual tests
 */
export const mockErrorPatterns = {
  sampleOperation: vi.fn((error: unknown, operation: string) => {
    console.error(
      `Failed to ${operation}:`,
      error instanceof Error ? error.message : String(error),
    );
  }),
};

// Mock the module export
vi.mock("@romper/app/renderer/utils/errorHandling", () => ({
  ErrorPatterns: mockErrorPatterns,
}));
