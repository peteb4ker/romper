import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

import { LocalStoreValidationDetailedResult } from "../../../shared/db/schema.js";

type ThemeMode = "light" | "system" | "dark";

interface Settings {
  localStorePath: string | null;
  themeMode: ThemeMode;
  defaultToMonoSamples: boolean;
  confirmDestructiveActions: boolean;
}

interface SettingsState {
  settings: Settings;
  localStoreStatus: LocalStoreValidationDetailedResult | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

type SettingsAction =
  | { type: "INIT_START" }
  | { type: "INIT_SUCCESS"; payload: Settings }
  | { type: "INIT_ERROR"; payload: string }
  | { type: "UPDATE_LOCAL_STORE_PATH"; payload: string }
  | { type: "UPDATE_THEME_MODE"; payload: ThemeMode }
  | { type: "UPDATE_DEFAULT_TO_MONO_SAMPLES"; payload: boolean }
  | { type: "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS"; payload: boolean }
  | {
      type: "UPDATE_LOCAL_STORE_STATUS";
      payload: LocalStoreValidationDetailedResult | null;
    }
  | { type: "CLEAR_ERROR" };

interface SettingsContextProps {
  // Current settings
  localStorePath: string | null;
  themeMode: ThemeMode;
  isDarkMode: boolean; // Computed property for backwards compatibility
  defaultToMonoSamples: boolean;
  confirmDestructiveActions: boolean;
  localStoreStatus: LocalStoreValidationDetailedResult | null;

  // State
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  setLocalStorePath: (path: string) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setDefaultToMonoSamples: (enabled: boolean) => Promise<void>;
  setConfirmDestructiveActions: (enabled: boolean) => Promise<void>;
  refreshLocalStoreStatus: () => Promise<void>;
  clearError: () => void;
}

const initialState: SettingsState = {
  settings: {
    localStorePath: null,
    themeMode: "system", // Default to system preference
    defaultToMonoSamples: true, // Task 7.1.1: Default to true
    confirmDestructiveActions: true, // Task 12.1.2: Default to true
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

    case "UPDATE_THEME_MODE":
      return {
        ...state,
        settings: { ...state.settings, themeMode: action.payload },
      };

    case "UPDATE_DEFAULT_TO_MONO_SAMPLES":
      return {
        ...state,
        settings: { ...state.settings, defaultToMonoSamples: action.payload },
      };

    case "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS":
      return {
        ...state,
        settings: {
          ...state.settings,
          confirmDestructiveActions: action.payload,
        },
      };

    case "UPDATE_LOCAL_STORE_STATUS":
      return { ...state, localStoreStatus: action.payload };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    default:
      return state;
  }
}

// Helper function to detect system theme preference
function getSystemThemePreference(): boolean {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

// Helper function to determine if dark mode should be active
function shouldUseDarkMode(themeMode: ThemeMode): boolean {
  switch (themeMode) {
    case "dark":
      return true;
    case "light":
      return false;
    case "system":
      return getSystemThemePreference();
    default:
      return false;
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

  // Refresh local store status
  const refreshLocalStoreStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.getLocalStoreStatus();
      dispatch({ type: "UPDATE_LOCAL_STORE_STATUS", payload: status });
    } catch (error) {
      console.error("Failed to refresh local store status:", error);
      dispatch({ type: "UPDATE_LOCAL_STORE_STATUS", payload: null });
    }
  }, []);

  // Initialize settings on mount
  const initializeSettings = useCallback(async () => {
    dispatch({ type: "INIT_START" });

    try {
      const loadedSettings = await window.electronAPI.readSettings();

      const settings: Settings = {
        localStorePath: loadedSettings.localStorePath || null,
        themeMode: loadedSettings.themeMode ?? "system", // Default to system preference
        defaultToMonoSamples: loadedSettings.defaultToMonoSamples ?? true, // Task 7.1.1: Default to true
        confirmDestructiveActions:
          loadedSettings.confirmDestructiveActions ?? true, // Task 12.1.2: Default to true
      };

      dispatch({ type: "INIT_SUCCESS", payload: settings });
      applyTheme(shouldUseDarkMode(settings.themeMode));

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

  // Update theme mode setting
  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      try {
        await window.electronAPI.setSetting("themeMode", mode);
        dispatch({ type: "UPDATE_THEME_MODE", payload: mode });
        applyTheme(shouldUseDarkMode(mode));
      } catch (error) {
        console.error("Failed to update theme mode:", error);
      }
    },
    [applyTheme],
  );

  // Update default to mono samples setting
  const setDefaultToMonoSamples = useCallback(async (enabled: boolean) => {
    try {
      await window.electronAPI.setSetting("defaultToMonoSamples", enabled);
      dispatch({ type: "UPDATE_DEFAULT_TO_MONO_SAMPLES", payload: enabled });
    } catch (error) {
      console.error("Failed to update defaultToMonoSamples setting:", error);
    }
  }, []);

  // Update confirm destructive actions setting
  const setConfirmDestructiveActions = useCallback(async (enabled: boolean) => {
    try {
      await window.electronAPI.setSetting("confirmDestructiveActions", enabled);
      dispatch({
        type: "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS",
        payload: enabled,
      });
    } catch (error) {
      console.error(
        "Failed to update confirmDestructiveActions setting:",
        error,
      );
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

  // Listen for system theme changes when using "system" mode
  useEffect(() => {
    if (
      state.settings.themeMode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia
    ) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      const handleSystemThemeChange = () => {
        if (state.settings.themeMode === "system") {
          applyTheme(mediaQuery.matches);
        }
      };

      mediaQuery.addEventListener("change", handleSystemThemeChange);

      return () => {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      };
    }
  }, [state.settings.themeMode, applyTheme]);

  const contextValue: SettingsContextProps = {
    // Current settings
    localStorePath: state.settings.localStorePath,
    themeMode: state.settings.themeMode,
    isDarkMode: shouldUseDarkMode(state.settings.themeMode), // Computed property
    defaultToMonoSamples: state.settings.defaultToMonoSamples,
    confirmDestructiveActions: state.settings.confirmDestructiveActions,
    localStoreStatus: state.localStoreStatus,

    // State
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    error: state.error,

    // Actions
    setLocalStorePath,
    setThemeMode,
    setDefaultToMonoSamples,
    setConfirmDestructiveActions,
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
export type { Settings, SettingsContextProps, ThemeMode };
export type { LocalStoreValidationDetailedResult } from "../../../shared/db/schema.js";
export { SettingsContext };
