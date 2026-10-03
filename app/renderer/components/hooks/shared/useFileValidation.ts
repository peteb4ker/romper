import type {
  FormatIssue,
  FormatValidationResult,
} from "@romper/shared/audioTypes";

import { useCallback } from "react";

import type { DropRejectionReason } from "../../utils/dropRejections";

import { createLogger } from "../../../utils/logger";

const log = createLogger("FileValidation");

/** A dropped file's check: its format, or why it can't be added */
export type DroppedFileCheck =
  | { rejection: DropRejectionReason }
  | { validation: FormatValidationResult };

// Extended File interface for Electron context where dropped files may have a path property
interface ElectronFile extends File {
  path?: string;
}

// Issues that stop a file being added; the rest are converted at write time
const CRITICAL_ISSUES = new Set<FormatIssue["type"]>([
  "extension",
  "fileAccess",
  "invalidFormat",
]);

/**
 * Why a file with these format issues can't be added, or null when it can
 * (its issues are converted when the kit is written to the card).
 */
export function rejectionForIssues(
  issues: FormatIssue[],
): DropRejectionReason | null {
  const critical = issues.filter((issue) => CRITICAL_ISSUES.has(issue.type));
  if (critical.length === 0) return null;
  return critical.some((issue) => issue.type === "extension")
    ? "notWav"
    : "unreadable";
}

/**
 * Hook for file validation and format checking
 * Extracted from useDragAndDrop to reduce complexity
 */
export function useFileValidation() {
  const getFilePathFromDrop = useCallback(
    async (file: File): Promise<string> => {
      if (globalThis.electronFileAPI?.getDroppedFilePath) {
        return await globalThis.electronFileAPI.getDroppedFilePath(file);
      }
      return (file as ElectronFile).path || file.name;
    },
    [],
  );

  /** Checks a dropped file's format; the caller tells the user a rejection */
  const validateDroppedFile = useCallback(
    async (filePath: string): Promise<DroppedFileCheck> => {
      if (!globalThis.electronAPI?.validateSampleFormat) {
        log.warn("Format validation not available");
        return { rejection: "checkFailed" };
      }

      const result =
        await globalThis.electronAPI.validateSampleFormat(filePath);
      if (!result.success || !result.data) {
        log.warn("Format validation failed:", result.error);
        return { rejection: "checkFailed" };
      }

      const validation = result.data;
      if (!validation.isValid) {
        const rejection = rejectionForIssues(validation.issues);
        if (rejection) return { rejection };
        log.info(
          "Sample has format issues that will require conversion during SD card sync:",
          validation.issues.map((i) => i.message).join(", "),
        );
      }

      return { validation };
    },
    [],
  );

  return {
    getFilePathFromDrop,
    validateDroppedFile,
  };
}
