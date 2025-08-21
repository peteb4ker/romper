import { getErrorMessage } from "@romper/shared/errorUtils.js";
import { toast } from "sonner";

/**
 * Enhanced error handling utilities for kit data management operations
 * Reduces duplication and standardizes error handling patterns across hooks
 */

/**
 * Standard error handler for kit data operations
 */
export class KitDataErrorHandler {
  constructor(private readonly context: string) {}

  /**
   * Handle errors from kit data API calls
   * Logs error and returns a standardized error response
   */
  handleApiError(
    error: unknown,
    operation: string,
    options: {
      defaultValue?: unknown;
      showToast?: boolean;
      silent?: boolean;
    } = {},
  ): { data?: undefined; error: string; success: false } {
    const errorMessage = getErrorMessage(error);
    const fullMessage = `Failed to ${operation}: ${errorMessage}`;

    if (!options.silent) {
      console.error(`[${this.context}] ${fullMessage}`, error);
    }

    if (options.showToast) {
      toast.error(`Kit ${operation} failed`, {
        description: errorMessage,
        duration: 5000,
      });
    }

    return {
      data: undefined,
      error: fullMessage,
      success: false,
    };
  }

  /**
   * Handle database result errors with standard patterns
   */
  handleDbResult<T>(
    result: { data?: T; error?: string; success: boolean } | undefined,
    operation: string,
    fallbackValue: T,
  ): T {
    if (!result?.success) {
      const errorMessage = result?.error || "Unknown database error";
      console.error(`[${this.context}] Failed to ${operation}:`, errorMessage);
      return fallbackValue;
    }

    return result.data ?? fallbackValue;
  }

  /**
   * Handle sample loading errors with consistent fallbacks
   */
  handleSampleLoadError(
    error: unknown,
    kitName: string,
    silent: boolean = false,
  ): { 1: string[]; 2: string[]; 3: string[]; 4: string[] } {
    if (!silent) {
      console.error(`Error loading samples for kit ${kitName}:`, error);
    }

    // Return empty voice structure as fallback
    return { 1: [], 2: [], 3: [], 4: [] };
  }

  /**
   * Wrap async operations with consistent error handling
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackValue: T,
    options: { rethrow?: boolean; silent?: boolean } = {},
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!options.silent) {
        console.error(`[${this.context}] Error ${operationName}:`, error);
      }

      if (options.rethrow) {
        throw error;
      }

      return fallbackValue;
    }
  }
}

/**
 * Specialized error handlers for different kit operations
 */
export const KitErrorHandlers = {
  /**
   * Handler for favorite operations
   */
  favorites: new KitDataErrorHandler("Favorites"),

  /**
   * Handler for kit metadata operations
   */
  metadata: new KitDataErrorHandler("KitMetadata"),

  /**
   * Handler for sample operations
   */
  samples: new KitDataErrorHandler("Samples"),

  /**
   * Handler for sync operations
   */
  sync: new KitDataErrorHandler("Sync"),
};

/**
 * Common error handling patterns for specific operations
 */
export const KitErrorPatterns = {
  /**
   * Handle API validation errors
   */
  apiValidation: (result: unknown, operation: string): void => {
    if (!result || typeof result !== 'object' || !('success' in result) || !result.success) {
      const errorMessage = (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') 
        ? result.error 
        : `Failed to ${operation}`;
      throw new Error(errorMessage);
    }
  },

  /**
   * Handle favorite toggle errors
   */
  favoriteToggle: (error: unknown, kitName: string): { success: false } => {
    console.error(`Error toggling kit favorite for ${kitName}:`, error);
    return { success: false };
  },

  /**
   * Handle kit loading errors with appropriate fallbacks
   */
  kitLoading: (error: unknown): { kits: unknown[]; samples: {} } => {
    console.error("Error loading data from database:", error);
    return { kits: [], samples: {} };
  },

  /**
   * Handle kit update errors with rethrowing
   */
  kitUpdate: (error: unknown, operation: string): never => {
    console.error(`Error ${operation}:`, error);
    throw error;
  },
};

/**
 * Async operation wrapper for consistent loading states and error handling
 */
export interface AsyncOperationOptions<T> {
  errorHandler?: KitDataErrorHandler;
  onError?: (error: unknown) => void;
  onSuccess?: (result: T) => void;
  operation: () => Promise<T>;
  operationName?: string;
  silent?: boolean;
}

/**
 * Execute async operation with standardized error handling
 */
export async function executeAsyncOperation<T>(
  options: AsyncOperationOptions<T>,
): Promise<{ data?: T; error?: string; success: boolean }> {
  try {
    const result = await options.operation();
    options.onSuccess?.(result);
    return { data: result, success: true };
  } catch (error) {
    if (options.errorHandler && options.operationName) {
      return options.errorHandler.handleApiError(error, options.operationName, {
        silent: options.silent,
      });
    }

    const errorMessage = getErrorMessage(error);
    if (!options.silent) {
      console.error("Async operation failed:", error);
    }

    options.onError?.(error);
    return { error: errorMessage, success: false };
  }
}

/**
 * Validation utilities for API responses
 */
export const ApiValidation = {
  /**
   * Check if API method exists before calling
   */
  checkApiMethod(
    apiMethod: unknown,
    methodName: string,
  ): asserts apiMethod is (...args: unknown[]) => unknown {
    if (!apiMethod || typeof apiMethod !== "function") {
      throw new Error(`${methodName} API method not available`);
    }
  },

  /**
   * Validate API response structure
   */
  validateResponse<T>(
    response: unknown,
    operation: string,
  ): { data: T; success: true } | { error: string; success: false } {
    if (!response) {
      return { error: `No response from ${operation}`, success: false };
    }

    if (typeof response === 'object' && 'success' in response && response.success === false) {
      const errorMsg = (typeof response === 'object' && 'error' in response && typeof response.error === 'string') 
        ? response.error 
        : `${operation} failed`;
      return { error: errorMsg, success: false };
    }

    if (typeof response === 'object' && 'data' in response) {
      return { data: response.data as T, success: true };
    }
    
    return { data: response as T, success: true };
  },
};
