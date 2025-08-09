import { useState } from "react";

export function useKitErrorHandling() {
  const [error, setError] = useState<null | string>(null);
  const [sdCardWarning, setSdCardWarning] = useState<null | string>(null);

  const clearError = () => setError(null);
  const clearSdCardWarning = () => setSdCardWarning(null);
  const clearAllErrors = () => {
    setError(null);
    setSdCardWarning(null);
  };

  return {
    clearAllErrors,
    // Actions
    clearError,

    clearSdCardWarning,
    // State
    error,
    sdCardWarning,

    // Setters
    setError,
    setSdCardWarning,
  };
}
