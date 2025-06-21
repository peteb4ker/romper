import React, { useState } from "react";

import { SettingsContext, SettingsProvider } from "../../utils/SettingsContext";

// Test wrapper that always provides initialized settings
export const TestSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Provide a default localStorePath and settingsInitialized=true for tests
  const [settingsInitialized] = useState(true);
  const [localStorePath, setLocalStorePath] = useState("/mock/local/store");
  const [darkMode, setDarkMode] = useState(false);
  const initializeSettings = async () => {};
  const localStoreStatus = { isValid: true, hasLocalStore: true };
  const refreshLocalStoreStatus = async () => {};

  return (
    <SettingsContext.Provider
      value={{
        localStorePath,
        setLocalStorePath,
        darkMode,
        setDarkMode,
        initializeSettings,
        settingsInitialized,
        localStoreStatus,
        refreshLocalStoreStatus,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
