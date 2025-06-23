import React, { useState } from "react";

import { SettingsContext, type SettingsContextProps } from "../../utils/SettingsContext";

// Test wrapper that always provides initialized settings
export const TestSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Provide default settings for tests
  const [localStorePath, setLocalStorePathState] = useState("/mock/local/store");
  const [darkMode, setDarkModeState] = useState(false);
  
  const setLocalStorePath = async (path: string) => {
    setLocalStorePathState(path);
  };
  
  const setDarkMode = async (enabled: boolean) => {
    setDarkModeState(enabled);
  };
  
  const refreshLocalStoreStatus = async () => {};
  const clearError = () => {};

  const contextValue: SettingsContextProps = {
    // Current settings
    localStorePath,
    darkMode,
    localStoreStatus: { 
      hasLocalStore: true, 
      localStorePath, 
      isValid: true 
    },
    
    // State
    isLoading: false,
    isInitialized: true,
    error: null,
    
    // Actions
    setLocalStorePath,
    setDarkMode,
    refreshLocalStoreStatus,
    clearError,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
