import { useCallback } from "react";
import { toast } from "sonner";

// Extended File interface for Electron context where dropped files may have a path property
interface ElectronFile extends File {
  path?: string;
}

// Local type definitions to avoid import issues
interface FormatIssue {
  current?: number | string;
  message: string;
  required?: number | readonly (number | string)[] | string;
  type:
    | "bitDepth"
    | "channels"
    | "extension"
    | "fileAccess"
    | "invalidFormat"
    | "sampleRate";
}

interface FormatValidationResult {
  issues: FormatIssue[];
  isValid: boolean;
  metadata?: {
    bitDepth?: number;
    channels?: number;
    duration?: number;
    fileSize?: number;
    sampleRate?: number;
  };
}

/**
 * Hook for file validation and format checking
 * Extracted from useDragAndDrop to reduce complexity
 */
export function useFileValidation() {
  const getFilePathFromDrop = useCallback(
    async (file: File): Promise<string> => {
      if (window.electronFileAPI?.getDroppedFilePath) {
        return await window.electronFileAPI.getDroppedFilePath(file);
      }
      return (file as ElectronFile).path || file.name;
    },
    [],
  );

  const handleValidationIssues = useCallback(
    async (validation: FormatValidationResult): Promise<boolean> => {
      const criticalIssues = validation.issues.filter((issue: FormatIssue) =>
        ["extension", "fileAccess", "invalidFormat"].includes(issue.type),
      );

      if (criticalIssues.length > 0) {
        const errorMessage = criticalIssues
          .map((i: FormatIssue) => i.message)
          .join(", ");
        console.error(
          "Cannot assign sample due to critical format issues:",
          errorMessage,
        );

        toast.error("Cannot assign sample", {
          description: errorMessage,
          duration: 5000,
        });
        return false;
      }

      const warningMessage = validation.issues
        .map((i: FormatIssue) => i.message)
        .join(", ");
      console.warn(
        "Sample has format issues that will require conversion during SD card sync:",
        warningMessage,
      );

      toast.warning("Sample format warning", {
        description: `${warningMessage} The sample will be converted during SD card sync.`,
        duration: 7000,
      });
      return true;
    },
    [],
  );

  const validateDroppedFile = useCallback(
    async (filePath: string) => {
      if (!window.electronAPI?.validateSampleFormat) {
        console.error("Format validation not available");
        return null;
      }

      const result = await window.electronAPI.validateSampleFormat(filePath);
      if (!result.success || !result.data) {
        console.error("Format validation failed:", result.error);
        return null;
      }

      const validation = result.data;
      if (!validation.isValid) {
        const handled = await handleValidationIssues(validation);
        if (!handled) return null;
      }

      return validation;
    },
    [handleValidationIssues],
  );

  return {
    getFilePathFromDrop,
    handleValidationIssues,
    validateDroppedFile,
  };
}
