import React, { useCallback, useMemo, useState } from "react";

import {
  SettingsContext,
  type ThemeMode,
} from "../../app/renderer/utils/SettingsContext";

// Test wrapper that always provides initialized settings
export const TestSettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Provide default settings for tests
  const [localStorePath, setLocalStorePath] = useState("/mock/local/store");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [defaultToMonoSamples, setDefaultToMonoSamples] = useState(true);
  const [confirmDestructiveActions, setConfirmDestructiveActions] =
    useState(true);

  const setLocalStorePathAsync = useCallback(async (path: string) => {
    setLocalStorePath(path);
  }, []);

  const setThemeModeFunc = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const setDefaultToMonoSamplesFunc = useCallback((enabled: boolean) => {
    setDefaultToMonoSamples(enabled);
  }, []);

  const setConfirmDestructiveActionsFunc = useCallback((enabled: boolean) => {
    setConfirmDestructiveActions(enabled);
  }, []);

  const contextValue = useMemo(
    () => ({
      // Current settings
      localStorePath,
      themeMode,
      isDarkMode: themeMode === "dark",
      defaultToMonoSamples,
      confirmDestructiveActions,
      localStoreStatus: {
        isValid: true,
        hasLocalStore: true,
        localStorePath: "/mock/local/store",
      },

      // State
      isInitialized: true,

      // Actions
      setLocalStorePath: setLocalStorePathAsync,
      setThemeMode: setThemeModeFunc,
      setDefaultToMonoSamples: setDefaultToMonoSamplesFunc,
      setConfirmDestructiveActions: setConfirmDestructiveActionsFunc,
    }),
    [
      localStorePath,
      themeMode,
      defaultToMonoSamples,
      confirmDestructiveActions,
      setLocalStorePathAsync,
      setThemeModeFunc,
      setDefaultToMonoSamplesFunc,
      setConfirmDestructiveActionsFunc,
    ],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
