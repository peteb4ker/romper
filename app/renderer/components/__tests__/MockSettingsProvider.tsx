import React from "react";

import { SettingsContext, type ThemeMode } from "../../utils/SettingsContext";

export const MockSettingsProvider: React.FC<{
  children: React.ReactNode;
  themeMode?: ThemeMode;
  defaultToMonoSamples?: boolean;
  confirmDestructiveActions?: boolean;
}> = ({
  children,
  themeMode = "light",
  defaultToMonoSamples = true,
  confirmDestructiveActions = true,
}) => (
  <SettingsContext.Provider
    value={{
      themeMode,
      setThemeMode: () => {},
      isDarkMode: themeMode === "dark" || (themeMode === "system" && false),
      defaultToMonoSamples,
      setDefaultToMonoSamples: () => {},
      confirmDestructiveActions,
      setConfirmDestructiveActions: () => {},
      localStorePath: "/mock/local/store",
      setLocalStorePath: async () => {},
      localStoreStatus: { isValid: true },
    }}
  >
    {children}
  </SettingsContext.Provider>
);
