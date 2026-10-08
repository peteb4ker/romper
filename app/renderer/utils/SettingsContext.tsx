import { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

import { config } from "../config";
import { applyTheme } from "./appliedTheme";

interface Settings {
  confirmDestructiveActions: boolean;
  localStorePath: null | string;
  themeMode: ThemeMode;
}

type SettingsAction =
  | { payload: boolean; type: "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS" }
  | {
      payload: LocalStoreValidationDetailedResult | null;
      type: "UPDATE_LOCAL_STORE_STATUS";
    }
  | { payload: null | string; type: "UPDATE_LOCAL_STORE_PATH" }
  | { payload: Settings; type: "INIT_SUCCESS" }
  | { payload: string; type: "INIT_ERROR" }
  | { payload: string; type: "SET_ERROR" }
  | { payload: ThemeMode; type: "UPDATE_THEME_MODE" }
  | { type: "CLEAR_ERROR" }
  | { type: "INIT_START" };

interface SettingsContextProps {
  clearError: () => void;
  confirmDestructiveActions: boolean;
  error: null | string;
  isDarkMode: boolean; // Computed property for backwards compatibility
  isInitialized: boolean;

  // State
  isLoading: boolean;
  // Current settings
  localStorePath: null | string;
  localStoreStatus: LocalStoreValidationDetailedResult | null;

  refreshLocalStoreStatus: () => Promise<void>;
  /**
   * Save whether to confirm destructive actions. Resolves to whether the
   * save worked; the setting changes only once it has (#570).
   */
  setConfirmDestructiveActions: (enabled: boolean) => Promise<boolean>;
  // Actions
  /**
   * Save the local store path (null forgets it, which opens the setup
   * wizard). Resolves to whether the save worked; a failure is also set as
   * the context's error.
   */
  setLocalStorePath: (path: null | string) => Promise<boolean>;
  /**
   * Save the theme. Resolves to whether the save worked; the theme changes
   * only once it has (#570).
   */
  setThemeMode: (mode: ThemeMode) => Promise<boolean>;
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
    localStorePath: null,
    themeMode: "system", // Default to system preference
  },
};

// Helper function to build a user-facing error message from a caught error
function describeError(prefix: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${detail}`;
}

// Main's view of the local store, or null when it can't be read
async function fetchLocalStoreStatus(): Promise<LocalStoreValidationDetailedResult | null> {
  try {
    return await globalThis.electronAPI.getLocalStoreStatus();
  } catch (error) {
    console.error("Failed to refresh local store status:", error);
    return null;
  }
}

// Helper function to detect system theme preference
function getSystemThemePreference(): boolean {
  if (typeof globalThis !== "undefined" && globalThis.matchMedia) {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
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

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS":
      return {
        ...state,
        settings: {
          ...state.settings,
          confirmDestructiveActions: action.payload,
        },
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

  // Refresh local store status
  const refreshLocalStoreStatus = useCallback(async () => {
    const status = await fetchLocalStoreStatus();
    dispatch({ payload: status, type: "UPDATE_LOCAL_STORE_STATUS" });
  }, []);

  // Initialize settings on mount
  const initializeSettings = useCallback(async () => {
    dispatch({ type: "INIT_START" });

    try {
      const loadedSettings = await globalThis.electronAPI.readSettings();

      const settings: Settings = {
        confirmDestructiveActions:
          loadedSettings.confirmDestructiveActions ?? true, // Task 12.1.2: Default to true
        // Use environment override if available, otherwise use settings
        localStorePath:
          config.localStorePath || loadedSettings.localStorePath || null,
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
  }, [refreshLocalStoreStatus]);

  // Update local store path
  const setLocalStorePath = useCallback(async (path: null | string) => {
    try {
      await globalThis.electronAPI.setSetting("localStorePath", path);
      // The new path and its status land in the same render, so nothing
      // reads the new store while the old store's status still says it's
      // valid (#553)
      const status = await fetchLocalStoreStatus();
      dispatch({ payload: path, type: "UPDATE_LOCAL_STORE_PATH" });
      dispatch({ payload: status, type: "UPDATE_LOCAL_STORE_STATUS" });
      return true;
    } catch (error) {
      console.error("Failed to update local store path:", error);
      dispatch({
        payload: describeError("Failed to save local store path", error),
        type: "SET_ERROR",
      });
      return false;
    }
  }, []);

  // Update theme mode setting
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      await globalThis.electronAPI.setSetting("themeMode", mode);
      dispatch({ payload: mode, type: "UPDATE_THEME_MODE" });
      applyTheme(shouldUseDarkMode(mode));
      return true;
    } catch (error) {
      console.error("Failed to update theme mode:", error);
      dispatch({
        payload: describeError("Failed to save theme mode", error),
        type: "SET_ERROR",
      });
      return false;
    }
  }, []);

  // Update confirm destructive actions setting
  const setConfirmDestructiveActions = useCallback(async (enabled: boolean) => {
    try {
      await globalThis.electronAPI.setSetting(
        "confirmDestructiveActions",
        enabled,
      );
      dispatch({
        payload: enabled,
        type: "UPDATE_CONFIRM_DESTRUCTIVE_ACTIONS",
      });
      return true;
    } catch (error) {
      console.error(
        "Failed to update confirmDestructiveActions setting:",
        error,
      );
      dispatch({
        payload: describeError(
          "Failed to save destructive-action confirmation setting",
          error,
        ),
        type: "SET_ERROR",
      });
      return false;
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  // Initialize on mount
  useEffect(() => {
    void initializeSettings();
  }, [initializeSettings]);

  // Listen for system theme changes when using "system" mode
  useEffect(() => {
    if (
      state.settings.themeMode === "system" &&
      typeof globalThis !== "undefined" &&
      globalThis.matchMedia
    ) {
      const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");

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
  }, [state.settings.themeMode]);

  const contextValue: SettingsContextProps = useMemo(
    () => ({
      clearError,
      confirmDestructiveActions: state.settings.confirmDestructiveActions,
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
      // Actions
      setLocalStorePath,
      setThemeMode,
      themeMode: state.settings.themeMode,
    }),
    [
      clearError,
      state.settings.confirmDestructiveActions,
      state.error,
      state.settings.themeMode,
      state.isInitialized,
      state.isLoading,
      state.settings.localStorePath,
      state.localStoreStatus,
      refreshLocalStoreStatus,
      setConfirmDestructiveActions,
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

/**
 * Whether to ask before deleting or replacing a sample (RE-44). On by
 * default, including where no SettingsProvider is mounted.
 */
export const useConfirmDestructiveActions = (): boolean =>
  useContext(SettingsContext)?.confirmDestructiveActions ?? true;

// Export types for external use
export type { Settings, SettingsContextProps, ThemeMode };
export type { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";
export { SettingsContext };
