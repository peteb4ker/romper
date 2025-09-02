import type { DbResult } from "@romper/shared/db/schema.js";

import * as fs from "fs";

import {
  type FormatValidationResult,
  validateSampleFormat,
} from "../audioUtils.js";

export interface ErrorCategorizationResult {
  canRetry: boolean;
  type:
    | "disk_space"
    | "file_access"
    | "format_error"
    | "network"
    | "permission"
    | "unknown";
  userMessage: string;
}

export interface FileValidationResult {
  fileSize: number;
  isValid: boolean;
}

export interface SyncValidationError {
  error: string;
  filename: string;
  sourcePath: string;
  type: "access_denied" | "invalid_format" | "missing_file" | "other";
}

/**
 * Service responsible for validating sync operations and files
 */
export class SyncValidationService {
  /**
   * Add validation error to results array with proper categorization
   */
  addValidationError(
    validationErrors: SyncValidationError[],
    filename: string,
    sourcePath: string,
    error: unknown,
  ): void {
    const categorized = this.categorizeError(error, sourcePath);

    let errorType: SyncValidationError["type"];
    switch (categorized.type) {
      case "file_access":
        errorType = "missing_file";
        break;
      case "format_error":
        errorType = "invalid_format";
        break;
      case "permission":
        errorType = "access_denied";
        break;
      default:
        errorType = "other";
    }

    validationErrors.push({
      error: categorized.userMessage,
      filename,
      sourcePath,
      type: errorType,
    });
  }

  /**
   * Categorize errors for user-friendly messages and retry logic
   */
  categorizeError(
    error: unknown,
    filePath?: string,
  ): ErrorCategorizationResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerErrorMessage = errorMessage.toLowerCase();

    // Network-related errors
    if (
      lowerErrorMessage.includes("network") ||
      lowerErrorMessage.includes("timeout") ||
      lowerErrorMessage.includes("connection")
    ) {
      return {
        canRetry: true,
        type: "network",
        userMessage: `Network error occurred${
          filePath ? ` while processing ${filePath}` : ""
        }. Please check your connection and try again.`,
      };
    }

    // Permission errors
    if (
      lowerErrorMessage.includes("permission") ||
      lowerErrorMessage.includes("access denied") ||
      lowerErrorMessage.includes("eacces") ||
      lowerErrorMessage.includes("eperm")
    ) {
      return {
        canRetry: true,
        type: "permission",
        userMessage: `Permission denied${
          filePath ? ` accessing ${filePath}` : ""
        }. Please check file permissions and try again.`,
      };
    }

    // Disk space errors
    if (
      lowerErrorMessage.includes("no space") ||
      lowerErrorMessage.includes("disk full") ||
      lowerErrorMessage.includes("enospc")
    ) {
      return {
        canRetry: false,
        type: "disk_space",
        userMessage:
          "Insufficient disk space. Please free up space and try again.",
      };
    }

    // File access errors
    if (
      lowerErrorMessage.includes("no such file") ||
      lowerErrorMessage.includes("enoent") ||
      lowerErrorMessage.includes("file not found")
    ) {
      return {
        canRetry: false,
        type: "file_access",
        userMessage: `File not found${
          filePath ? `: ${filePath}` : ""
        }. Please check the file path.`,
      };
    }

    // Format-related errors
    if (
      lowerErrorMessage.includes("invalid format") ||
      lowerErrorMessage.includes("unsupported format") ||
      lowerErrorMessage.includes("codec") ||
      lowerErrorMessage.includes("format error")
    ) {
      return {
        canRetry: false,
        type: "format_error",
        userMessage: `Unsupported audio format${
          filePath ? ` in ${filePath}` : ""
        }. Please convert the file to a supported format.`,
      };
    }

    // Default case
    return {
      canRetry: true,
      type: "unknown",
      userMessage: `An unexpected error occurred${
        filePath ? ` while processing ${filePath}` : ""
      }: ${errorMessage}`,
    };
  }

  /**
   * Validate sample format for sync compatibility
   */
  validateSampleFormat(sourcePath: string): DbResult<FormatValidationResult> {
    return validateSampleFormat(sourcePath);
  }

  /**
   * Validates source file existence and gets size for sync
   */
  validateSyncSourceFile(
    filename: string,
    sourcePath: string,
    validationErrors: SyncValidationError[],
  ): FileValidationResult {
    if (!fs.existsSync(sourcePath)) {
      validationErrors.push({
        error: `Source file not found: ${sourcePath}`,
        filename,
        sourcePath,
        type: "missing_file",
      });
      return { fileSize: 0, isValid: false };
    }

    const stats = fs.statSync(sourcePath);
    return { fileSize: stats.size, isValid: true };
  }
}

export const syncValidationService = new SyncValidationService();
