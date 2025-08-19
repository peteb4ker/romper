import {
  createErrorHandler,
  getErrorMessage,
} from "@romper/shared/errorUtils.js";
import { toast } from "sonner";

/**
 * Extended error handler for renderer that includes toast notifications
 */
export interface RendererErrorHandler {
  /**
   * Combined log + toast for common error handling pattern
   */
  handleError(
    error: unknown,
    operation: string,
    userMessage: string,
    options?: { duration?: number }
  ): void;

  /**
   * Log error to console with context
   */
  logError(error: unknown, operation: string): void;

  /**
   * Show error toast notification
   */
  showErrorToast(
    title: string,
    error: unknown,
    options?: { duration?: number }
  ): void;
}

/**
 * Creates a renderer error handler with toast integration
 * Standardizes the common pattern: console.error + toast.error
 */
export function createRendererErrorHandler(
  context: string
): RendererErrorHandler {
  const baseHandler = createErrorHandler(context);

  return {
    handleError(
      error: unknown,
      operation: string,
      userMessage: string,
      options?: { duration?: number }
    ): void {
      this.logError(error, operation);
      this.showErrorToast(userMessage, error, options);
    },

    logError(error: unknown, operation: string): void {
      baseHandler.logError(error, operation);
    },

    showErrorToast(
      title: string,
      error: unknown,
      options?: { duration?: number }
    ): void {
      toast.error(title, {
        description: baseHandler.formatErrorForUser(error),
        duration: options?.duration ?? 5000,
      });
    },
  };
}

/**
 * Common error handling patterns for renderer hooks
 */
export const ErrorPatterns = {
  /**
   * Handle API operation errors
   */
  apiOperation: (error: unknown, operation: string) => {
    console.error(`Failed to ${operation}:`, getErrorMessage(error));
    toast.error(`Operation failed`, {
      description: error instanceof Error ? error.message : String(error),
      duration: 5000,
    });
  },

  /**
   * Handle kit operation errors
   */
  kitOperation: (error: unknown, operation: string) => {
    console.error(`Failed to ${operation}:`, getErrorMessage(error));
    toast.error(`Kit ${operation} failed`, {
      description: error instanceof Error ? error.message : String(error),
      duration: 5000,
    });
  },

  /**
   * Handle sample operation errors
   */
  sampleOperation: (error: unknown, operation: string) => {
    console.error(`Failed to ${operation}:`, getErrorMessage(error));
    toast.error(`Failed to ${operation}`, {
      description: error instanceof Error ? error.message : String(error),
      duration: 5000,
    });
  },
};
