/**
 * Lightweight error handling for renderer hooks
 * Combines console logging and toast notifications
 */
export interface ErrorHandler {
  /**
   * Show user-facing error notification
   * Returns formatted description for toast.error()
   */
  formatErrorForUser(error: unknown): string;

  /**
   * Log error to console with context
   */
  logError(error: unknown, operation: string): void;
}

export class KitError extends Error {
  constructor(
    message: string,
    public readonly context?: string,
  ) {
    super(message);
    this.name = "KitError";
  }
}

/**
 * Standard error types for consistent error handling across the app
 */
export class SampleError extends Error {
  constructor(
    message: string,
    public readonly context?: string,
  ) {
    super(message);
    this.name = "SampleError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Creates a lightweight error handler for renderer hooks
 * Standardizes the pattern: console.error + toast notification
 */
export function createErrorHandler(_context: string): ErrorHandler {
  return {
    formatErrorForUser(error: unknown): string {
      return error instanceof Error ? error.message : String(error);
    },

    logError(error: unknown, operation: string): void {
      const message = getErrorMessage(error);
      console.error(`Failed to ${operation}:`, message);
    },
  };
}

/**
 * Creates a standardized error result object
 *
 * @param error - Unknown error object
 * @param prefix - Optional prefix for the error message
 * @returns Formatted error result with success: false
 */
export function createErrorResult(
  error: unknown,
  prefix?: string,
): { error: string; success: false } {
  const message = getErrorMessage(error);
  return {
    error: prefix ? `${prefix}: ${message}` : message,
    success: false,
  };
}

/**
 * Converts an unknown error to a string message
 * Reduces duplication across the codebase where this pattern is used
 *
 * @param error - Unknown error object, typically from catch blocks
 * @returns String representation of the error
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Logs an error with consistent formatting
 *
 * @param error - Unknown error object
 * @param context - Context string for logging
 */
export function logError(error: unknown, context: string): void {
  const message = getErrorMessage(error);
  console.error(`[${context}] Error: ${message}`);
  if (error instanceof Error && error.stack) {
    console.error(`[${context}] Stack: ${error.stack}`);
  }
}
