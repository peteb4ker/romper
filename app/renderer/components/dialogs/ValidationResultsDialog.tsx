import React from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";

import { KitValidationError } from "../../../../shared/db/schema.js";
import { useValidationResults } from "../hooks/useValidationResults";

interface ValidationResultsDialogProps {
  isOpen: boolean;
  localStorePath?: string;
  onClose: () => void;
  onMessage?: (msg: { duration?: number; text: string; type?: string }) => void;
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
      <ul className="max-h-60 overflow-y-auto border border-gray-300 dark:border-slate-600 rounded">
        {errors.map((error) => (
          <li
            className={`p-2 border-b border-gray-300 dark:border-slate-600 last:border-b-0 hover:bg-gray-100 dark:hover:bg-slate-700 ${
              selectedKits.includes(error.kitName)
                ? "bg-blue-100 dark:bg-blue-900"
                : ""
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
                  <div className="text-sm text-red-600 dark:text-red-400">
                    <span className="font-semibold">Missing files:</span>{" "}
                    {error.missingFiles.join(", ")}
                  </div>
                )}
                {error.extraFiles.length > 0 && (
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {validationResult?.isValid ? (
              <FiCheckCircle className="text-green-500" size={24} />
            ) : (
              <FiAlertTriangle className="text-yellow-500" size={24} />
            )}
            Local Store Validation Results
          </h2>
          <button
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={onClose}
          >
            <FiX size={24} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 rounded border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700">
              <p className="font-medium">
                {validationResult?.isValid ? (
                  <span className="text-green-600 dark:text-green-400">
                    No validation errors found. The database matches the file
                    system.
                  </span>
                ) : (
                  <span className="text-yellow-600 dark:text-yellow-400">
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

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-300 dark:border-slate-600">
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
                      className="px-4 py-2 bg-gray-300 dark:bg-slate-700 rounded hover:bg-gray-400 dark:hover:bg-slate-600 transition-colors"
                      disabled={isRescanning}
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      className={`px-4 py-2 rounded flex items-center gap-2 ${
                        selectedKits.length === 0
                          ? "bg-blue-300 dark:bg-blue-900 cursor-not-allowed opacity-60"
                          : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600"
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
                          <FiRefreshCw />
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
