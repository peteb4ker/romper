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
  const [localStorePath, setLocalStorePath] = useState<null | string>(
    "/mock/local/store",
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [confirmDestructiveActions, setConfirmDestructiveActions] =
    useState(true);

  const setLocalStorePathAsync = useCallback(async (path: null | string) => {
    setLocalStorePath(path);
    return true;
  }, []);

  const setThemeModeFunc = useCallback(async (mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const setConfirmDestructiveActionsFunc = useCallback(
    async (enabled: boolean) => {
      setConfirmDestructiveActions(enabled);
    },
    [],
  );

  const refreshLocalStoreStatus = useCallback(async () => {
    // Mock implementation - no-op for tests
  }, []);

  const contextValue = useMemo(
    () => ({
      clearError: () => {},
      confirmDestructiveActions,
      error: null,
      isDarkMode: themeMode === "dark",
      // State
      isInitialized: true,
      isLoading: false,
      // Current settings
      localStorePath,
      localStoreStatus: {
        hasLocalStore: true,
        isValid: true,
        localStorePath: "/mock/local/store",
      },
      refreshLocalStoreStatus,

      setConfirmDestructiveActions: setConfirmDestructiveActionsFunc,

      // Actions
      setLocalStorePath: setLocalStorePathAsync,
      setThemeMode: setThemeModeFunc,
      themeMode,
    }),
    [
      localStorePath,
      themeMode,
      confirmDestructiveActions,
      setLocalStorePathAsync,
      setThemeModeFunc,
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
