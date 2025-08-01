import * as fs from "fs";
import * as path from "path";

import type { DbResult } from "../../../shared/db/schema.js";
import { getErrorMessage } from "../../../shared/errorUtils.js";
import { convertToRampleDefault } from "../formatConverter.js";
import {
  ensureDirectoryExists,
  getFileSize,
} from "../utils/fileSystemUtils.js";
import type { SyncFileOperation } from "./syncPlannerService.js";

export interface SyncErrorInfo {
  type:
    | "file_access"
    | "format_error"
    | "disk_space"
    | "permission"
    | "network"
    | "unknown";
  canRetry: boolean;
  userMessage: string;
}

/**
 * Service for executing sync operations (copy/convert files)
 * Extracted from syncService.ts for better testability
 */
export class SyncExecutorService {
  /**
   * Execute a single file operation (copy or convert)
   */
  async executeFileOperation(
    fileOp: SyncFileOperation,
    forceMonoConversion: boolean = false,
  ): Promise<DbResult<{ bytesTransferred: number }>> {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(fileOp.destinationPath);
      ensureDirectoryExists(destDir);

      let bytesTransferred = 0;

      if (fileOp.operation === "copy") {
        // Simple file copy
        fs.copyFileSync(fileOp.sourcePath, fileOp.destinationPath);

        // Get file size for tracking
        bytesTransferred = getFileSize(fileOp.sourcePath);
      } else if (fileOp.operation === "convert") {
        // Convert audio format during copy
        const conversionResult = await convertToRampleDefault(
          fileOp.sourcePath,
          fileOp.destinationPath,
          forceMonoConversion,
        );

        if (!conversionResult.success) {
          throw new Error(
            `Failed to convert ${fileOp.filename}: ${conversionResult.error}`,
          );
        }

        // Get converted file size for tracking
        bytesTransferred = getFileSize(fileOp.destinationPath);
      }

      return { success: true, data: { bytesTransferred } };
    } catch (error) {
      const errorInfo = this.categorizeError(error, fileOp.sourcePath);
      return {
        success: false,
        error: `${fileOp.filename}: ${errorInfo.userMessage}`,
      };
    }
  }

  /**
   * Get file size for progress tracking
   */
  getFileSize(filePath: string): number {
    return getFileSize(filePath);
  }

  /**
   * Calculate total size for a list of file operations
   */
  calculateTotalSize(fileOperations: SyncFileOperation[]): number {
    let totalBytes = 0;
    for (const fileOp of fileOperations) {
      totalBytes += this.getFileSize(fileOp.sourcePath);
    }
    return totalBytes;
  }

  /**
   * Categorize sync errors for better error reporting
   */
  categorizeError(error: any, filePath?: string): SyncErrorInfo {
    const errorMessage = getErrorMessage(error);
    const errorLower = errorMessage.toLowerCase();

    if (
      errorLower.includes("enoent") ||
      errorLower.includes("file not found")
    ) {
      return {
        type: "file_access",
        canRetry: false,
        userMessage: `Source file not found: ${filePath || "unknown file"}`,
      };
    }

    if (
      errorLower.includes("eacces") ||
      errorLower.includes("permission denied")
    ) {
      return {
        type: "permission",
        canRetry: true,
        userMessage: "Permission denied. Check file/folder permissions.",
      };
    }

    if (errorLower.includes("enospc") || errorLower.includes("no space")) {
      return {
        type: "disk_space",
        canRetry: false,
        userMessage: "Not enough disk space on destination drive.",
      };
    }

    if (
      errorLower.includes("format") ||
      errorLower.includes("wav") ||
      errorLower.includes("audio")
    ) {
      return {
        type: "format_error",
        canRetry: false,
        userMessage: `Audio format error: ${errorMessage}`,
      };
    }

    if (errorLower.includes("network") || errorLower.includes("connection")) {
      return {
        type: "network",
        canRetry: true,
        userMessage: "Network error. Check connection and try again.",
      };
    }

    return {
      type: "unknown",
      canRetry: true,
      userMessage: `Unexpected error: ${errorMessage}`,
    };
  }
}

export const syncExecutorService = new SyncExecutorService();
