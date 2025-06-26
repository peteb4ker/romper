// Scanner orchestrator - manages execution of scanning operation chains

import type {
  ChainResult,
  ErrorHandlingStrategy,
  ProgressCallback,
  ScanOperation,
} from "./types";

/**
 * Orchestrates the execution of scanning operations with progress tracking and error handling
 */
export class ScannerOrchestrator {
  private progressCallback?: ProgressCallback;
  private errorStrategy: ErrorHandlingStrategy;

  constructor(
    progressCallback?: ProgressCallback,
    errorStrategy: ErrorHandlingStrategy = "continue",
  ) {
    this.progressCallback = progressCallback;
    this.errorStrategy = errorStrategy;
  }

  /**
   * Executes a chain of scanning operations
   * @param operations Array of operations to execute
   * @returns Result containing success status, results, and errors
   */
  async executeChain(operations: ScanOperation[]): Promise<ChainResult> {
    const results: Record<string, any> = {};
    const errors: Array<{ operation: string; error: string }> = [];
    let completedOperations = 0;

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      // Report progress before starting operation
      this.progressCallback?.(i, operations.length, operation.name);

      try {
        const result = await operation.scanner(operation.input);

        if (result.success && result.data !== undefined) {
          results[operation.name] = result.data;
          completedOperations++;
        } else {
          // Operation failed
          const errorMessage = result.error || "Unknown error";
          errors.push({ operation: operation.name, error: errorMessage });

          if (this.errorStrategy === "stop") {
            // Stop execution on first error
            break;
          }
          // Continue with next operation if strategy is "continue"
        }
      } catch (error) {
        // Unexpected exception
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ operation: operation.name, error: errorMessage });

        if (this.errorStrategy === "stop") {
          // Stop execution on first error
          break;
        }
        // Continue with next operation if strategy is "continue"
      }
    }

    // Report completion
    this.progressCallback?.(operations.length, operations.length, "Complete");

    return {
      success: errors.length === 0,
      results,
      errors,
      completedOperations,
      totalOperations: operations.length,
    };
  }
}
