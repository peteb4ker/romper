import React from "react";

import { SettingsContext, type ThemeMode } from "../../utils/SettingsContext";

export const MockSettingsProvider: React.FC<{
  children: React.ReactNode;
  confirmDestructiveActions?: boolean;
  themeMode?: ThemeMode;
}> = ({ children, confirmDestructiveActions = true, themeMode = "light" }) => (
  <SettingsContext.Provider
    value={{
      confirmDestructiveActions,
      isDarkMode: themeMode === "dark",
      localStorePath: "/mock/local/store",
      localStoreStatus: { isValid: true },
      setConfirmDestructiveActions: () => {},
      setLocalStorePath: async () => {},
      setThemeMode: () => {},
      themeMode,
    }}
  >
    {children}
  </SettingsContext.Provider>
);
