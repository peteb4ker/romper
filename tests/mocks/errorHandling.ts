import { vi } from "vitest";

/**
 * Mock implementation of error handling patterns for tests
 * Simple mocks that only handle console.error - toast is mocked separately in individual tests
 */
export const mockErrorPatterns = {
  apiOperation: vi.fn((error: unknown, operation: string) => {
    console.error(
      `Failed to ${operation}:`,
      error instanceof Error ? error.message : String(error),
    );
  }),

  kitOperation: vi.fn((error: unknown, operation: string) => {
    console.error(
      `Failed to ${operation}:`,
      error instanceof Error ? error.message : String(error),
    );
  }),

  sampleOperation: vi.fn((error: unknown, operation: string) => {
    console.error(
      `Failed to ${operation}:`,
      error instanceof Error ? error.message : String(error),
    );
  }),
};

/**
 * Mock factory for creating renderer error handlers in tests
 */
export const createMockRendererErrorHandler = () => ({
  handleError: vi.fn(
    (error: unknown, operation: string, _userMessage: string) => {
      console.error(
        `Failed to ${operation}:`,
        error instanceof Error ? error.message : String(error),
      );
    },
  ),

  logError: vi.fn((error: unknown, operation: string) => {
    console.error(
      `Failed to ${operation}:`,
      error instanceof Error ? error.message : String(error),
    );
  }),

  showErrorToast: vi.fn(),
});

// Mock the module export
vi.mock("@romper/app/renderer/utils/errorHandling", () => ({
  createRendererErrorHandler: vi.fn(() => createMockRendererErrorHandler()),
  ErrorPatterns: mockErrorPatterns,
}));
