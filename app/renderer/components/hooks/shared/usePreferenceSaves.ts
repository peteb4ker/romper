import { useCallback } from "react";

import { type ThemeMode, useSettings } from "../../../utils/SettingsContext";
import { useMessageApi } from "./useMessageApi";

export const THEME_NOT_SAVED = "Couldn't save the theme setting. Try again.";

export const CONFIRM_DESTRUCTIVE_NOT_SAVED =
  'Couldn\'t save the "Confirm destructive actions" setting. Try again.';

/**
 * The theme and "Confirm destructive actions" setters, saying so when a
 * save fails. The setting only changes once it's saved, so the control
 * keeps showing the saved value (#570).
 */
export function usePreferenceSaves() {
  const { setConfirmDestructiveActions, setThemeMode } = useSettings();
  const { showMessage } = useMessageApi();

  const saveThemeMode = useCallback(
    async (mode: ThemeMode) => {
      if (!(await setThemeMode(mode))) showMessage(THEME_NOT_SAVED, "error");
    },
    [setThemeMode, showMessage],
  );

  const saveConfirmDestructiveActions = useCallback(
    async (enabled: boolean) => {
      if (!(await setConfirmDestructiveActions(enabled))) {
        showMessage(CONFIRM_DESTRUCTIVE_NOT_SAVED, "error");
      }
    },
    [setConfirmDestructiveActions, showMessage],
  );

  return { saveConfirmDestructiveActions, saveThemeMode };
}
