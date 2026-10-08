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
