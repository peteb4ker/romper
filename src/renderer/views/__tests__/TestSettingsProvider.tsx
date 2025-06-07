import React, { useState } from 'react';

import { SettingsContext,SettingsProvider } from '../../utils/SettingsContext';

// Test wrapper that always provides initialized settings
export const TestSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Provide a default sdCardPath and settingsInitialized=true for tests
  const [settingsInitialized] = useState(true);
  const [sdCardPath, setSdCardPath] = useState('/test-sd');
  const [darkMode, setDarkMode] = useState(false);
  const initializeSettings = async () => {};
  return (
    <SettingsContext.Provider value={{
      sdCardPath,
      setSdCardPath,
      darkMode,
      setDarkMode,
      initializeSettings,
      settingsInitialized
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
