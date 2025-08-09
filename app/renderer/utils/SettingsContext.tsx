import { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

interface Settings {
  confirmDestructiveActions: boolean;
  defaultToMonoSamples: boolean;
  localStorePath: null | string;
  themeMode: ThemeMode;
}

type SettingsAction =
  | { payload: boolean; type: "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS" }
  | { payload: boolean; type: "UPDATE_DEFAULT_TO_MONO_SAMPLES" }
  | {
      payload: LocalStoreValidationDetailedResult | null;
      type: "UPDATE_LOCAL_STORE_STATUS";
    }
  | { payload: Settings; type: "INIT_SUCCESS" }
  | { payload: string; type: "INIT_ERROR" }
  | { payload: string; type: "UPDATE_LOCAL_STORE_PATH" }
  | { payload: ThemeMode; type: "UPDATE_THEME_MODE" }
  | { type: "CLEAR_ERROR" }
  | { type: "INIT_START" };

interface SettingsContextProps {
  clearError: () => void;
  confirmDestructiveActions: boolean;
  defaultToMonoSamples: boolean;
  error: null | string;
  isDarkMode: boolean; // Computed property for backwards compatibility
  isInitialized: boolean;

  // State
  isLoading: boolean;
  // Current settings
  localStorePath: null | string;
  localStoreStatus: LocalStoreValidationDetailedResult | null;

  refreshLocalStoreStatus: () => Promise<void>;
  setConfirmDestructiveActions: (enabled: boolean) => Promise<void>;
  setDefaultToMonoSamples: (enabled: boolean) => Promise<void>;
  // Actions
  setLocalStorePath: (path: string) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  themeMode: ThemeMode;
}

interface SettingsState {
  error: null | string;
  isInitialized: boolean;
  isLoading: boolean;
  localStoreStatus: LocalStoreValidationDetailedResult | null;
  settings: Settings;
}

type ThemeMode = "dark" | "light" | "system";

const initialState: SettingsState = {
  error: null,
  isInitialized: false,
  isLoading: false,
  localStoreStatus: null,
  settings: {
    confirmDestructiveActions: true, // Task 12.1.2: Default to true
    defaultToMonoSamples: true, // Task 7.1.1: Default to true
    localStorePath: null,
    themeMode: "system", // Default to system preference
  },
};

// Helper function to detect system theme preference
function getSystemThemePreference(): boolean {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

function settingsReducer(
  state: SettingsState,
  action: SettingsAction,
): SettingsState {
  switch (action.type) {
    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "INIT_ERROR":
      return {
        ...state,
        error: action.payload,
        isInitialized: true,
        isLoading: false,
      };

    case "INIT_START":
      return { ...state, error: null, isLoading: true };

    case "INIT_SUCCESS":
      return {
        ...state,
        error: null,
        isInitialized: true,
        isLoading: false,
        settings: action.payload,
      };

    case "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS":
      return {
        ...state,
        settings: {
          ...state.settings,
          confirmDestructiveActions: action.payload,
        },
      };

    case "UPDATE_DEFAULT_TO_MONO_SAMPLES":
      return {
        ...state,
        settings: { ...state.settings, defaultToMonoSamples: action.payload },
      };

    case "UPDATE_LOCAL_STORE_PATH":
      return {
        ...state,
        settings: { ...state.settings, localStorePath: action.payload },
      };

    case "UPDATE_LOCAL_STORE_STATUS":
      return { ...state, localStoreStatus: action.payload };

    case "UPDATE_THEME_MODE":
      return {
        ...state,
        settings: { ...state.settings, themeMode: action.payload },
      };

    default:
      return state;
  }
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
      dispatch({ payload: status, type: "UPDATE_LOCAL_STORE_STATUS" });
    } catch (error) {
      console.error("Failed to refresh local store status:", error);
      dispatch({ payload: null, type: "UPDATE_LOCAL_STORE_STATUS" });
    }
  }, []);

  // Initialize settings on mount
  const initializeSettings = useCallback(async () => {
    dispatch({ type: "INIT_START" });

    try {
      const loadedSettings = await window.electronAPI.readSettings();

      const settings: Settings = {
        confirmDestructiveActions:
          loadedSettings.confirmDestructiveActions ?? true, // Task 12.1.2: Default to true
        defaultToMonoSamples: loadedSettings.defaultToMonoSamples ?? true, // Task 7.1.1: Default to true
        localStorePath: loadedSettings.localStorePath || null,
        themeMode: loadedSettings.themeMode ?? "system", // Default to system preference
      };

      dispatch({ payload: settings, type: "INIT_SUCCESS" });
      applyTheme(shouldUseDarkMode(settings.themeMode));

      // Load local store status
      await refreshLocalStoreStatus();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to initialize settings";
      dispatch({ payload: errorMessage, type: "INIT_ERROR" });
    }
  }, [applyTheme, refreshLocalStoreStatus]);

  // Update local store path
  const setLocalStorePath = useCallback(
    async (path: string) => {
      try {
        await window.electronAPI.setSetting("localStorePath", path);
        dispatch({ payload: path, type: "UPDATE_LOCAL_STORE_PATH" });
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
        dispatch({ payload: mode, type: "UPDATE_THEME_MODE" });
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
      dispatch({ payload: enabled, type: "UPDATE_DEFAULT_TO_MONO_SAMPLES" });
    } catch (error) {
      console.error("Failed to update defaultToMonoSamples setting:", error);
    }
  }, []);

  // Update confirm destructive actions setting
  const setConfirmDestructiveActions = useCallback(async (enabled: boolean) => {
    try {
      await window.electronAPI.setSetting("confirmDestructiveActions", enabled);
      dispatch({
        payload: enabled,
        type: "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS",
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

  const contextValue: SettingsContextProps = useMemo(
    () => ({
      clearError,
      confirmDestructiveActions: state.settings.confirmDestructiveActions,
      defaultToMonoSamples: state.settings.defaultToMonoSamples,
      error: state.error,
      isDarkMode: shouldUseDarkMode(state.settings.themeMode), // Computed property
      isInitialized: state.isInitialized,

      // State
      isLoading: state.isLoading,
      // Current settings
      localStorePath: state.settings.localStorePath,
      localStoreStatus: state.localStoreStatus,

      refreshLocalStoreStatus,
      setConfirmDestructiveActions,
      setDefaultToMonoSamples,
      // Actions
      setLocalStorePath,
      setThemeMode,
      themeMode: state.settings.themeMode,
    }),
    [
      clearError,
      state.settings.confirmDestructiveActions,
      state.settings.defaultToMonoSamples,
      state.error,
      state.settings.themeMode,
      state.isInitialized,
      state.isLoading,
      state.settings.localStorePath,
      state.localStoreStatus,
      refreshLocalStoreStatus,
      setConfirmDestructiveActions,
      setDefaultToMonoSamples,
      setLocalStorePath,
      setThemeMode,
    ],
  );

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
export type { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";
export { SettingsContext };
