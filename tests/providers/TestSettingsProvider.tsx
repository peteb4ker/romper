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

  const refreshLocalStoreStatus = useCallback(async () => {
    // Mock implementation - no-op for tests
  }, []);

  const contextValue = useMemo(
    () => ({
      confirmDestructiveActions,
      defaultToMonoSamples,
      isDarkMode: themeMode === "dark",
      // State
      isInitialized: true,
      // Current settings
      localStorePath,
      localStoreStatus: {
        hasLocalStore: true,
        isValid: true,
        localStorePath: "/mock/local/store",
      },
      refreshLocalStoreStatus,

      setConfirmDestructiveActions: setConfirmDestructiveActionsFunc,

      setDefaultToMonoSamples: setDefaultToMonoSamplesFunc,
      // Actions
      setLocalStorePath: setLocalStorePathAsync,
      setThemeMode: setThemeModeFunc,
      themeMode,
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
      refreshLocalStoreStatus,
    ],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};
