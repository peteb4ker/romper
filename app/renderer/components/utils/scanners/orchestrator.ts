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
  private readonly errorStrategy: ErrorHandlingStrategy;
  private readonly progressCallback?: ProgressCallback;

  constructor(
    progressCallback?: ProgressCallback,
    errorStrategy: ErrorHandlingStrategy = "continue"
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
    const errors: Array<{ error: string; operation: string }> = [];
    let completedOperations = 0;

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      // Report progress before starting operation
      this.progressCallback?.(i, operations.length, operation.name);

      const shouldContinue = await this.executeOperation(
        operation,
        results,
        errors
      );

      if (results[operation.name]) {
        completedOperations++;
      }

      if (!shouldContinue) {
        break;
      }
    }

    // Report completion
    this.progressCallback?.(operations.length, operations.length, "Complete");

    return {
      completedOperations,
      errors,
      results,
      success: errors.length === 0,
      totalOperations: operations.length,
    };
  }

  /**
   * Executes a single operation and handles errors
   * @param operation The operation to execute
   * @param results Results accumulator
   * @param errors Errors accumulator
   * @returns true if should continue, false if should stop
   */
  private async executeOperation(
    operation: ScanOperation,
    results: Record<string, any>,
    errors: Array<{ error: string; operation: string }>
  ): Promise<boolean> {
    try {
      const result = await operation.scanner(operation.input);

      if (result.success && result.data !== undefined) {
        results[operation.name] = result.data;
      } else {
        return this.handleOperationError(operation, result.error, errors);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return this.handleOperationError(operation, errorMessage, errors);
    }

    return true;
  }

  /**
   * Handles operation errors and determines if execution should continue
   * @param operation The failed operation
   * @param errorMessage The error message
   * @param errors Errors accumulator
   * @returns true if should continue, false if should stop
   */
  private handleOperationError(
    operation: ScanOperation,
    errorMessage: string | undefined,
    errors: Array<{ error: string; operation: string }>
  ): boolean {
    const message = errorMessage || "Unknown error";
    errors.push({ error: message, operation: operation.name });

    return this.errorStrategy !== "stop";
  }
}
