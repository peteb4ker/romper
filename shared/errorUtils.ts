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
 * Creates a standardized error result object
 *
 * @param error - Unknown error object
 * @param prefix - Optional prefix for the error message
 * @returns Formatted error result with success: false
 */
export function createErrorResult(
  error: unknown,
  prefix?: string,
): { success: false; error: string } {
  const message = getErrorMessage(error);
  return {
    success: false,
    error: prefix ? `${prefix}: ${message}` : message,
  };
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
