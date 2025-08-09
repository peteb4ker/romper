import React from "react";

import { SettingsContext, type ThemeMode } from "../../utils/SettingsContext";

export const MockSettingsProvider: React.FC<{
  children: React.ReactNode;
  confirmDestructiveActions?: boolean;
  defaultToMonoSamples?: boolean;
  themeMode?: ThemeMode;
}> = ({
  children,
  confirmDestructiveActions = true,
  defaultToMonoSamples = true,
  themeMode = "light",
}) => (
  <SettingsContext.Provider
    value={{
      confirmDestructiveActions,
      defaultToMonoSamples,
      isDarkMode: themeMode === "dark",
      localStorePath: "/mock/local/store",
      localStoreStatus: { isValid: true },
      setConfirmDestructiveActions: () => {},
      setDefaultToMonoSamples: () => {},
      setLocalStorePath: async () => {},
      setThemeMode: () => {},
      themeMode,
    }}
  >
    {children}
  </SettingsContext.Provider>
);
