import React, { createContext, useContext, useEffect, useState } from "react";

interface SettingsContextProps {
  sdCardPath: string | null;
  setSdCardPath: (path: string) => void;
  localStorePath: string | null;
  setLocalStorePath: (path: string) => void;
  initializeSettings: () => Promise<void>;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  settingsInitialized: boolean;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [sdCardPath, setSdCardPathState] = useState<string | null>(null);
  const [localStorePath, setLocalStorePathState] = useState<string | null>(
    null,
  );
  const [darkMode, setDarkModeState] = useState<boolean>(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});

  const setSdCardPath = (path: string) => {
    const updatedSettings = { ...settings, sdCardPath: path };
    setSettings(updatedSettings);
    setSdCardPathState(path);
    window.electronAPI.setSetting("sdCardPath", path);
  };

  const setLocalStorePath = (path: string) => {
    const updatedSettings = { ...settings, localStorePath: path };
    setSettings(updatedSettings);
    setLocalStorePathState(path);
    window.electronAPI.setSetting("localStorePath", path);
  };

  const setDarkMode = (enabled: boolean) => {
    const updatedSettings = { ...settings, darkMode: enabled };
    setSettings(updatedSettings);
    setDarkModeState(enabled);
    window.electronAPI.setSetting("darkMode", enabled);

    // Apply or remove the 'dark' class on the document element
    if (enabled) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const initializeSettings = async () => {
    try {
      console.log("Initializing settings...");
      const loadedSettings = await window.electronAPI.readSettings();
      console.log("Loaded settings:", loadedSettings);

      if (loadedSettings.sdCardPath) {
        console.log("Setting sdCardPath state:", loadedSettings.sdCardPath);
        setSdCardPathState(loadedSettings.sdCardPath);
      }
      if (loadedSettings.localStorePath) {
        setLocalStorePathState(loadedSettings.localStorePath);
      }
      if (typeof loadedSettings.darkMode === "boolean") {
        console.log("Setting darkMode state:", loadedSettings.darkMode);
        setDarkModeState(loadedSettings.darkMode);
      }
    } catch (error) {
      console.error("Failed to initialize settings:", error);
    } finally {
      setSettingsInitialized(true);
    }
  };

  useEffect(() => {
    initializeSettings();
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        sdCardPath,
        setSdCardPath,
        localStorePath,
        setLocalStorePath,
        darkMode,
        setDarkMode,
        initializeSettings,
        settingsInitialized,
      }}
    >
      {settingsInitialized ? children : null}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextProps => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export { SettingsContext };
