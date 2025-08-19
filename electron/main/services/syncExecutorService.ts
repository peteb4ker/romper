import type { DbResult } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as fs from "fs";
import * as path from "path";

import type { SyncFileOperation } from "./syncPlannerService.js";

import { convertToRampleDefault } from "../formatConverter.js";
import {
  categorizeErrorByRules,
  type SyncErrorInfo,
} from "../utils/errorCategorizationUtils.js";
import {
  ensureDirectoryExists,
  getFileSize,
} from "../utils/fileSystemUtils.js";

/**
 * Service for executing sync operations (copy/convert files)
 * Extracted from syncService.ts for better testability
 */
export class SyncExecutorService {
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
    return categorizeErrorByRules(errorMessage, filePath);
  }

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

      return { data: { bytesTransferred }, success: true };
    } catch (error) {
      const errorInfo = this.categorizeError(error, fileOp.sourcePath);
      return {
        error: `${fileOp.filename}: ${errorInfo.userMessage}`,
        success: false,
      };
    }
  }

  /**
   * Get file size for progress tracking
   */
  getFileSize(filePath: string): number {
    return getFileSize(filePath);
  }
}

export const syncExecutorService = new SyncExecutorService();
