import React, { useState } from "react";

import { SettingsContext, type ThemeMode } from "../../utils/SettingsContext";

// Test wrapper that always provides initialized settings
export const TestSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Provide default settings for tests
  const [localStorePath, setLocalStorePathState] =
    useState("/mock/local/store");
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [defaultToMonoSamples, setDefaultToMonoSamplesState] = useState(true);
  const [confirmDestructiveActions, setConfirmDestructiveActionsState] =
    useState(true);

  const setLocalStorePath = async (path: string) => {
    setLocalStorePathState(path);
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const setDefaultToMonoSamples = (enabled: boolean) => {
    setDefaultToMonoSamplesState(enabled);
  };

  const setConfirmDestructiveActions = (enabled: boolean) => {
    setConfirmDestructiveActionsState(enabled);
  };

  const contextValue = {
    // Current settings
    localStorePath,
    themeMode,
    isDarkMode: themeMode === "dark" || (themeMode === "system" && false),
    defaultToMonoSamples,
    confirmDestructiveActions,
    localStoreStatus: {
      isValid: true,
    },

    // Actions
    setLocalStorePath,
    setThemeMode,
    setDefaultToMonoSamples,
    setConfirmDestructiveActions,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
