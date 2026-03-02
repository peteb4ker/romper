import {
  ArrowsClockwise,
  CheckCircle,
  Warning,
  X,
} from "@phosphor-icons/react";
import { KitValidationError } from "@romper/shared/db/schema.js";
import React from "react";

import { useValidationResults } from "../hooks/shared/useValidationResults";

interface ValidationResultsDialogProps {
  isOpen: boolean;
  localStorePath?: string;
  onClose: () => void;
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

const ValidationResultsDialog: React.FC<ValidationResultsDialogProps> = ({
  isOpen,
  localStorePath,
  onClose,
  onMessage,
}) => {
  const {
    groupedErrors,
    isLoading,
    isRescanning,
    rescanSelectedKits,
    selectAllKits,
    selectedKits,
    toggleKitSelection,
    validateLocalStore,
    validationResult,
  } = useValidationResults({
    localStorePath,
    onMessage,
  });

  // Trigger validation when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      validateLocalStore();
    }
  }, [isOpen, validateLocalStore]);

  if (!isOpen) return null;

  const hasErrors =
    validationResult?.errors && validationResult.errors.length > 0;
  const allSelected =
    hasErrors && selectedKits.length === validationResult?.errors?.length;

  const renderErrorList = (errors: KitValidationError[], title: string) => (
    <div className="mb-6">
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <ul className="max-h-60 overflow-y-auto border border-border-default rounded">
        {errors.map((error) => (
          <li
            className={`p-2 border-b border-border-default last:border-b-0 hover:bg-surface-3 ${
              selectedKits.includes(error.kitName) ? "bg-accent-primary/15" : ""
            }`}
            key={error.kitName}
          >
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                checked={selectedKits.includes(error.kitName)}
                className="mt-1"
                onChange={() => toggleKitSelection(error.kitName)}
                type="checkbox"
              />
              <div className="flex-grow">
                <div className="font-bold">{error.kitName}</div>
                {error.missingFiles.length > 0 && (
                  <div className="text-sm text-accent-danger">
                    <span className="font-semibold">Missing files:</span>{" "}
                    {error.missingFiles.join(", ")}
                  </div>
                )}
                {error.extraFiles.length > 0 && (
                  <div className="text-sm text-accent-warning">
                    <span className="font-semibold">Extra files:</span>{" "}
                    {error.extraFiles.join(", ")}
                  </div>
                )}
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-2 border border-border-subtle w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {validationResult?.isValid ? (
              <CheckCircle className="text-accent-success" size={24} />
            ) : (
              <Warning className="text-accent-warning" size={24} />
            )}
            Local Store Validation Results
          </h2>
          <button
            aria-label="Close"
            className="text-text-tertiary hover:text-text-primary"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary"></div>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 rounded border border-border-default bg-surface-3">
              <p className="font-medium">
                {validationResult?.isValid ? (
                  <span className="text-accent-success">
                    No validation errors found. The database matches the file
                    system.
                  </span>
                ) : (
                  <span className="text-accent-warning/80">
                    {validationResult?.errorSummary ||
                      "Validation errors found in the local store."}
                  </span>
                )}
              </p>
              {!validationResult?.isValid && (
                <p className="mt-2 text-sm">
                  Select the kits you want to fix and click "Rescan Selected
                  Kits" to update the database to match the file system.
                </p>
              )}
            </div>

            {groupedErrors && (
              <div className="space-y-4">
                {groupedErrors.missing.length > 0 &&
                  renderErrorList(
                    groupedErrors.missing,
                    "Kits with missing files (files in database but not in file system)",
                  )}

                {groupedErrors.extra.length > 0 &&
                  renderErrorList(
                    groupedErrors.extra,
                    "Kits with extra files (files in file system but not in database)",
                  )}

                {groupedErrors.both.length > 0 &&
                  renderErrorList(
                    groupedErrors.both,
                    "Kits with both missing and extra files",
                  )}

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border-default">
                  <div className="flex items-center">
                    <input
                      checked={allSelected}
                      className="mr-2"
                      disabled={isRescanning}
                      id="select-all"
                      onChange={selectAllKits}
                      type="checkbox"
                    />
                    <label
                      className="cursor-pointer select-none"
                      htmlFor="select-all"
                    >
                      Select All
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="px-4 py-2 bg-surface-3 text-text-secondary rounded hover:bg-surface-4 transition-colors"
                      disabled={isRescanning}
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      className={`px-4 py-2 rounded flex items-center gap-2 ${
                        selectedKits.length === 0
                          ? "bg-accent-primary/50 cursor-not-allowed opacity-60"
                          : "bg-accent-primary hover:bg-accent-primary/80"
                      } text-white transition-colors`}
                      disabled={selectedKits.length === 0 || isRescanning}
                      onClick={rescanSelectedKits}
                    >
                      {isRescanning ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          Rescanning...
                        </>
                      ) : (
                        <>
                          <ArrowsClockwise size={16} />
                          Rescan Selected Kits
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ValidationResultsDialog;
