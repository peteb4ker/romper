import { useCallback, useEffect, useState } from "react";

import {
  KitValidationError,
  LocalStoreValidationDetailedResult,
} from "../../../../shared/dbTypesShared";

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

    validationResult.errors.forEach((error) => {
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
      const kitNames = validationResult.errors.map((e) => e.kitName);
      setSelectedKits(kitNames);
    }
  }, [validationResult]);

  const rescanSelectedKits = useCallback(async () => {
    if (selectedKits.length === 0 || !localStorePath) return;

    // Ensure we set isRescanning before anything else
    setIsRescanning(true);

    try {
      // For each selected kit, we need to rescan its directory
      // This would be implemented in a future task, but we prepare the UI now
      if (onMessage) {
        onMessage({
          text: "Rescanning kits will be implemented in task 2.13.6",
          type: "info",
        });
      }

      // For now, just close the dialog after a delay to simulate rescanning
      await new Promise((resolve) => setTimeout(resolve, 1500));
      closeValidationDialog();
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
