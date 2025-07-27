import { useCallback, useEffect, useState } from "react";

import {
  KitValidationError,
  LocalStoreValidationDetailedResult,
} from "../../../../shared/db/schema.js";

interface UseValidationResultsProps {
  localStorePath: string;
  onMessage?: (msg: { text: string; type?: string; duration?: number }) => void;
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

    return { missing, extra, both };
  }, [validationResult]);

  const validateLocalStore = useCallback(async () => {
    if (!localStorePath) return;

    setIsLoading(true);
    try {
      const result =
        await window.electronAPI.validateLocalStore(localStorePath);
      setValidationResult(result);

      if (!result.isValid && onMessage) {
        onMessage({
          text: result.errorSummary || "Validation errors found in local store",
          type: "error",
          duration: 5000,
        });
      }
    } catch (error) {
      if (onMessage) {
        onMessage({
          text: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
          type: "error",
        });
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
        : [...prev, kitName],
    );
  }, []);

  const selectAllKits = useCallback(() => {
    if (validationResult?.errors && validationResult.errors.length > 0) {
      const kitNames = validationResult.errors.map(
        (e: KitValidationError) => e.kitName,
      );
      setSelectedKits(kitNames);
    }
  }, [validationResult]);

  const rescanSelectedKits = useCallback(async () => {
    if (selectedKits.length === 0 || !localStorePath) return;

    // Ensure we set isRescanning before anything else
    setIsRescanning(true);

    try {
      const dbDir = `${localStorePath}/.romperdb`;
      let totalScannedSamples = 0;
      let totalUpdatedVoices = 0;
      const errors: string[] = [];

      // Rescan each selected kit
      for (const kitName of selectedKits) {
        try {
          const result = await window.electronAPI.rescanKit(kitName);

          if (result.success && result.data) {
            totalScannedSamples += result.data.scannedSamples;
            totalUpdatedVoices += result.data.updatedVoices;
          } else {
            errors.push(`${kitName}: ${result.error || "Rescan failed"}`);
          }
        } catch (error) {
          errors.push(
            `${kitName}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Show results
      if (onMessage) {
        if (errors.length === 0) {
          onMessage({
            text: `Successfully rescanned ${selectedKits.length} kit(s). Found ${totalScannedSamples} samples, updated ${totalUpdatedVoices} voices.`,
            type: "success",
            duration: 5000,
          });
        } else if (errors.length < selectedKits.length) {
          onMessage({
            text: `Partially completed rescan. ${selectedKits.length - errors.length} kit(s) succeeded, ${errors.length} failed. Found ${totalScannedSamples} samples.`,
            type: "warning",
            duration: 7000,
          });
        } else {
          onMessage({
            text: `Rescan failed for all ${selectedKits.length} kit(s). First error: ${errors[0]}`,
            type: "error",
            duration: 7000,
          });
        }
      }

      // Re-validate to show updated results
      const updatedValidation =
        await window.electronAPI.validateLocalStore(localStorePath);
      setValidationResult(updatedValidation);

      // Close dialog only if all rescans succeeded AND no validation errors remain
      if (errors.length === 0 && updatedValidation.isValid) {
        closeValidationDialog();
      }
    } catch (error) {
      if (onMessage) {
        onMessage({
          text: `Rescan error: ${error instanceof Error ? error.message : String(error)}`,
          type: "error",
        });
      }
    } finally {
      setIsRescanning(false);
    }
  }, [selectedKits, localStorePath, onMessage, closeValidationDialog]);

  return {
    isOpen,
    isLoading,
    isRescanning,
    validationResult,
    groupedErrors: groupedErrors(),
    selectedKits,
    openValidationDialog,
    closeValidationDialog,
    toggleKitSelection,
    selectAllKits,
    rescanSelectedKits,
    validateLocalStore,
  };
}
