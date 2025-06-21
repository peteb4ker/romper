import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface LocalStoreStatus {
  hasLocalStore: boolean;
  localStorePath: string | null;
  isValid: boolean;
  error?: string | null;
}

interface SettingsContextProps {
  localStorePath: string | null;
  setLocalStorePath: (path: string) => void;
  localStoreStatus: LocalStoreStatus | null;
  refreshLocalStoreStatus: () => Promise<void>;
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
  const [localStorePath, setLocalStorePathState] = useState<string | null>(
    null,
  );
  const [localStoreStatus, setLocalStoreStatus] =
    useState<LocalStoreStatus | null>(null);
  const [darkMode, setDarkModeState] = useState<boolean>(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});

  const setLocalStorePath = (path: string) => {
    console.log("[SettingsContext] setLocalStorePath called with:", path);
    const updatedSettings = { ...settings, localStorePath: path };
    console.log("[SettingsContext] Updated settings object:", updatedSettings);
    setSettings(updatedSettings);
    setLocalStorePathState(path);
    console.log("[SettingsContext] Set localStorePathState to:", path);
    window.electronAPI.setSetting("localStorePath", path);
    console.log("[SettingsContext] Called electronAPI.setSetting with localStorePath:", path);
    // Refresh local store status after setting path
    refreshLocalStoreStatus();
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

  const refreshLocalStoreStatus = useCallback(async () => {
    console.log("[SettingsContext] refreshLocalStoreStatus called");
    try {
      if (window.electronAPI?.getLocalStoreStatus) {
        console.log("[SettingsContext] Calling electronAPI.getLocalStoreStatus");
        const status = await window.electronAPI.getLocalStoreStatus();
        console.log("[SettingsContext] Received local store status:", status);
        setLocalStoreStatus(status);
      } else {
        console.log("[SettingsContext] getLocalStoreStatus not available");
      }
    } catch (error) {
      console.error("Failed to refresh local store status:", error);
      setLocalStoreStatus(null);
    }
  }, []);

  const initializeSettings = useCallback(async () => {
    try {
      console.log("Initializing settings...");
      const loadedSettings = await window.electronAPI.readSettings();
      console.log("Loaded settings:", loadedSettings);

      // Update the settings state object
      setSettings(loadedSettings);

      if (loadedSettings.localStorePath) {
        console.log(
          "Setting localStorePath state:",
          loadedSettings.localStorePath,
        );
        setLocalStorePathState(loadedSettings.localStorePath);
      }
      if (typeof loadedSettings.darkMode === "boolean") {
        console.log("Setting darkMode state:", loadedSettings.darkMode);
        setDarkModeState(loadedSettings.darkMode);
      }

      // Initialize local store status
      await refreshLocalStoreStatus();
    } catch (error) {
      console.error("Failed to initialize settings:", error);
    } finally {
      setSettingsInitialized(true);
    }
  }, [refreshLocalStoreStatus]);

  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  return (
    <SettingsContext.Provider
      value={{
        localStorePath,
        setLocalStorePath,
        darkMode,
        setDarkMode,
        initializeSettings,
        settingsInitialized,
        localStoreStatus,
        refreshLocalStoreStatus,
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
