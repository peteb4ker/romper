import React from "react";

import { createMockSettings } from "../../../../tests/mocks/settings";
import { SettingsContext, type ThemeMode } from "../../utils/SettingsContext";

export const MockSettingsProvider: React.FC<{
  children: React.ReactNode;
  confirmDestructiveActions?: boolean;
  themeMode?: ThemeMode;
}> = ({ children, confirmDestructiveActions = true, themeMode = "light" }) => (
  <SettingsContext.Provider
    value={createMockSettings({
      confirmDestructiveActions,
      isDarkMode: themeMode === "dark",
      localStorePath: "/mock/local/store",
      localStoreStatus: { isValid: true },
      themeMode,
    })}
  >
    {children}
  </SettingsContext.Provider>
);
