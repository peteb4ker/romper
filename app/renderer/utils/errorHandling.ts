import { getErrorMessage } from "@romper/shared/errorUtils.js";

/**
 * Common error handling patterns for renderer hooks
 * Log errors to console — UI feedback is handled inline by callers
 */
export const ErrorPatterns = {
  /**
   * Handle sample operation errors
   */
  sampleOperation: (error: unknown, operation: string) => {
    console.error(`Failed to ${operation}:`, getErrorMessage(error));
  },
};
