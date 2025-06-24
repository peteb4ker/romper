import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

interface LocalStoreStatus {
  hasLocalStore: boolean;
  localStorePath: string | null;
  isValid: boolean;
  error?: string | null;
}

interface Settings {
  localStorePath: string | null;
  darkMode: boolean;
}

interface SettingsState {
  settings: Settings;
  localStoreStatus: LocalStoreStatus | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

type SettingsAction =
  | { type: "INIT_START" }
  | { type: "INIT_SUCCESS"; payload: Settings }
  | { type: "INIT_ERROR"; payload: string }
  | { type: "UPDATE_LOCAL_STORE_PATH"; payload: string }
  | { type: "UPDATE_DARK_MODE"; payload: boolean }
  | { type: "UPDATE_LOCAL_STORE_STATUS"; payload: LocalStoreStatus | null }
  | { type: "CLEAR_ERROR" };

interface SettingsContextProps {
  // Current settings
  localStorePath: string | null;
  darkMode: boolean;
  localStoreStatus: LocalStoreStatus | null;

  // State
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  setLocalStorePath: (path: string) => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
  refreshLocalStoreStatus: () => Promise<void>;
  clearError: () => void;
}

const initialState: SettingsState = {
  settings: {
    localStorePath: null,
    darkMode: false,
  },
  localStoreStatus: null,
  isLoading: false,
  isInitialized: false,
  error: null,
};

function settingsReducer(
  state: SettingsState,
  action: SettingsAction,
): SettingsState {
  switch (action.type) {
    case "INIT_START":
      return { ...state, isLoading: true, error: null };

    case "INIT_SUCCESS":
      return {
        ...state,
        settings: action.payload,
        isLoading: false,
        isInitialized: true,
        error: null,
      };

    case "INIT_ERROR":
      return {
        ...state,
        isLoading: false,
        isInitialized: true,
        error: action.payload,
      };

    case "UPDATE_LOCAL_STORE_PATH":
      return {
        ...state,
        settings: { ...state.settings, localStorePath: action.payload },
      };

    case "UPDATE_DARK_MODE":
      return {
        ...state,
        settings: { ...state.settings, darkMode: action.payload },
      };

    case "UPDATE_LOCAL_STORE_STATUS":
      return { ...state, localStoreStatus: action.payload };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    default:
      return state;
  }
}

const SettingsContext = createContext<SettingsContextProps | undefined>(
  undefined,
);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(settingsReducer, initialState);

  // Apply theme to DOM
  const applyTheme = useCallback((isDark: boolean) => {
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  // Initialize settings on mount
  const initializeSettings = useCallback(async () => {
    dispatch({ type: "INIT_START" });

    try {
      const loadedSettings = await window.electronAPI.readSettings();
      const settings: Settings = {
        localStorePath: loadedSettings.localStorePath || null,
        darkMode: loadedSettings.darkMode ?? false,
      };

      dispatch({ type: "INIT_SUCCESS", payload: settings });
      applyTheme(settings.darkMode);

      // Load local store status
      await refreshLocalStoreStatus();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to initialize settings";
      dispatch({ type: "INIT_ERROR", payload: errorMessage });
    }
  }, [applyTheme, refreshLocalStoreStatus]);

  // Update local store path
  const setLocalStorePath = useCallback(
    async (path: string) => {
      try {
        await window.electronAPI.setSetting("localStorePath", path);
        dispatch({ type: "UPDATE_LOCAL_STORE_PATH", payload: path });
        await refreshLocalStoreStatus();
      } catch (error) {
        console.error("Failed to update local store path:", error);
      }
    },
    [refreshLocalStoreStatus],
  );

  // Update dark mode setting
  const setDarkMode = useCallback(
    async (enabled: boolean) => {
      try {
        await window.electronAPI.setSetting("darkMode", enabled);
        dispatch({ type: "UPDATE_DARK_MODE", payload: enabled });
        applyTheme(enabled);
      } catch (error) {
        console.error("Failed to update dark mode:", error);
      }
    },
    [applyTheme],
  );

  // Refresh local store status
  const refreshLocalStoreStatus = useCallback(async () => {
    try {
      if (window.electronAPI?.getLocalStoreStatus) {
        const status = await window.electronAPI.getLocalStoreStatus();
        dispatch({ type: "UPDATE_LOCAL_STORE_STATUS", payload: status });
      }
    } catch (error) {
      console.error("Failed to refresh local store status:", error);
      dispatch({ type: "UPDATE_LOCAL_STORE_STATUS", payload: null });
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  const contextValue: SettingsContextProps = {
    // Current settings
    localStorePath: state.settings.localStorePath,
    darkMode: state.settings.darkMode,
    localStoreStatus: state.localStoreStatus,

    // State
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    error: state.error,

    // Actions
    setLocalStorePath,
    setDarkMode,
    refreshLocalStoreStatus,
    clearError,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {state.isInitialized ? children : null}
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

// Export types for external use
export type { LocalStoreStatus, Settings, SettingsContextProps };
export { SettingsContext };
