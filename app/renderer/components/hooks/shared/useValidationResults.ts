import {
  KitValidationError,
  LocalStoreValidationDetailedResult,
} from "@romper/shared/db/schema.js";
import { useCallback, useState } from "react";

interface UseValidationResultsProps {
  localStorePath?: string;
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

export function useValidationResults({
  localStorePath,
  onMessage,
}: UseValidationResultsProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [validationResult, setValidationResult] =
    useState<LocalStoreValidationDetailedResult | null>(null);
  const [selectedKits, setSelectedKits] = useState<string[]>([]);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);

  // Group errors by type for better presentation
  const groupedErrors = useCallback(() => {
    if (!validationResult?.errors) return null;

    const missing: KitValidationError[] = [];
    const extra: KitValidationError[] = [];
    const both: KitValidationError[] = [];

    validationResult.errors.forEach((error: KitValidationError) => {
      if (error.missingFiles.length > 0 && error.extraFiles.length > 0) {
        both.push(error);
      } else if (error.missingFiles.length > 0) {
        missing.push(error);
      } else if (error.extraFiles.length > 0) {
        extra.push(error);
      }
    });

    return { both, extra, missing };
  }, [validationResult]);

  const validateLocalStore = useCallback(async () => {
    setIsLoading(true);
    try {
      const result =
        await window.electronAPI.validateLocalStore(localStorePath);
      setValidationResult(result);

      if (!result.isValid && onMessage) {
        onMessage(
          result.errorSummary || "Validation errors found in local store",
          "error",
          5000
        );
      }
    } catch (error) {
      if (onMessage) {
        onMessage(
          `Validation error: ${error instanceof Error ? error.message : String(error)}`,
          "error"
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [localStorePath, onMessage]);

  const openValidationDialog = useCallback(async () => {
    setIsOpen(true);
    await validateLocalStore();
  }, [validateLocalStore]);

  const closeValidationDialog = useCallback(() => {
    setIsOpen(false);
    setSelectedKits([]);
  }, []);

  const toggleKitSelection = useCallback((kitName: string) => {
    setSelectedKits((prev) =>
      prev.includes(kitName)
        ? prev.filter((k) => k !== kitName)
        : [...prev, kitName]
    );
  }, []);

  const selectAllKits = useCallback(() => {
    if (validationResult?.errors && validationResult.errors.length > 0) {
      const kitNames = validationResult.errors.map(
        (e: KitValidationError) => e.kitName
      );
      setSelectedKits(kitNames);
    }
  }, [validationResult]);

  // Helper function to rescan a single kit
  const rescanSingleKit = useCallback(async (kitName: string) => {
    try {
      const result = await window.electronAPI.rescanKit(kitName);

      if (result.success && result.data) {
        return {
          scannedSamples: result.data.scannedSamples,
          success: true,
          updatedVoices: result.data.updatedVoices,
        };
      } else {
        return {
          error: `${kitName}: ${result.error || "Rescan failed"}`,
          success: false,
        };
      }
    } catch (error) {
      return {
        error: `${kitName}: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  }, []);

  // Helper function to generate result message
  const getRescanMessage = useCallback(
    (
      selectedKitsCount: number,
      errors: string[],
      totalScannedSamples: number,
      totalUpdatedVoices: number
    ) => {
      if (errors.length === 0) {
        return {
          duration: 5000,
          text: `Successfully rescanned ${selectedKitsCount} kit(s). Found ${totalScannedSamples} samples, updated ${totalUpdatedVoices} voices.`,
          type: "success" as const,
        };
      } else if (errors.length < selectedKitsCount) {
        return {
          duration: 7000,
          text: `Partially completed rescan. ${selectedKitsCount - errors.length} kit(s) succeeded, ${errors.length} failed. Found ${totalScannedSamples} samples.`,
          type: "warning" as const,
        };
      } else {
        return {
          duration: 7000,
          text: `Rescan failed for all ${selectedKitsCount} kit(s). First error: ${errors[0]}`,
          type: "error" as const,
        };
      }
    },
    []
  );

  const rescanSelectedKits = useCallback(async () => {
    if (selectedKits.length === 0) return;

    setIsRescanning(true);

    try {
      let totalScannedSamples = 0;
      let totalUpdatedVoices = 0;
      const errors: string[] = [];

      // Process each kit
      for (const kitName of selectedKits) {
        const result = await rescanSingleKit(kitName);

        if (result.success) {
          totalScannedSamples += result.scannedSamples || 0;
          totalUpdatedVoices += result.updatedVoices || 0;
        } else {
          errors.push(result.error || "Unknown error");
        }
      }

      // Show results message
      if (onMessage) {
        const message = getRescanMessage(
          selectedKits.length,
          errors,
          totalScannedSamples,
          totalUpdatedVoices
        );
        onMessage(message.text, message.type, message.duration);
      }

      // Re-validate to show updated results
      const updatedValidation =
        await window.electronAPI.validateLocalStore(localStorePath);
      setValidationResult(updatedValidation);

      // Close dialog if successful and valid
      if (errors.length === 0 && updatedValidation.isValid) {
        closeValidationDialog();
      }
    } catch (error) {
      if (onMessage) {
        onMessage(
          `Rescan error: ${error instanceof Error ? error.message : String(error)}`,
          "error"
        );
      }
    } finally {
      setIsRescanning(false);
    }
  }, [
    selectedKits,
    localStorePath,
    onMessage,
    closeValidationDialog,
    rescanSingleKit,
    getRescanMessage,
  ]);

  return {
    closeValidationDialog,
    groupedErrors: groupedErrors(),
    isLoading,
    isOpen,
    isRescanning,
    openValidationDialog,
    rescanSelectedKits,
    selectAllKits,
    selectedKits,
    toggleKitSelection,
    validateLocalStore,
    validationResult,
  };
}
