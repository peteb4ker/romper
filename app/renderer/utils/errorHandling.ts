import {
  createErrorHandler,
  getErrorMessage,
} from "@romper/shared/errorUtils.js";

/**
 * Extended error handler for renderer
 */
export interface RendererErrorHandler {
  /**
   * Combined log for common error handling pattern
   */
  handleError(error: unknown, operation: string, userMessage: string): void;

  /**
   * Log error to console with context
   */
  logError(error: unknown, operation: string): void;
}

/**
 * Creates a renderer error handler
 * Logs errors to console — callers handle user-facing feedback inline
 */
export function createRendererErrorHandler(
  context: string,
): RendererErrorHandler {
  const baseHandler = createErrorHandler(context);

  return {
    handleError(error: unknown, operation: string, _userMessage: string): void {
      this.logError(error, operation);
    },

    logError(error: unknown, operation: string): void {
      baseHandler.logError(error, operation);
    },
  };
}

/**
 * Common error handling patterns for renderer hooks
 * Log errors to console — UI feedback is handled inline by callers
 */
export const ErrorPatterns = {
  /**
   * Handle API operation errors
   */
  apiOperation: (error: unknown, operation: string) => {
    console.error(`Failed to ${operation}:`, getErrorMessage(error));
  },

  /**
   * Handle kit operation errors
   */
  kitOperation: (error: unknown, operation: string) => {
    console.error(`Failed to ${operation}:`, getErrorMessage(error));
  },

  /**
   * Handle sample operation errors
   */
  sampleOperation: (error: unknown, operation: string) => {
    console.error(`Failed to ${operation}:`, getErrorMessage(error));
  },
};
