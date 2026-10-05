import { useCallback, useState } from "react";

/**
 * Said when the local store setting can't be saved: by Choose Existing
 * Store, by setup once the store is built (#528), and by Set Up a New Local
 * Store when the saved store can't be cleared
 */
export const LOCAL_STORE_SETTING_NOT_SAVED =
  "Couldn't save the local store setting. Try again.";

/**
 * Choose Existing Store, shared by the setup wizard and Preferences: main
 * shows a folder picker and checks the folder holds a local store, then the
 * path is saved. A folder that isn't a store, or a save that fails, leaves
 * `error` saying why, and nothing changes (RE-78).
 */
export function useChooseExistingLocalStore(
  saveLocalStorePath: (path: string) => Promise<boolean>,
) {
  const [error, setError] = useState<null | string>(null);
  const [isChoosing, setIsChoosing] = useState(false);

  /** Resolves true once the chosen store is saved */
  const chooseExistingStore = useCallback(async (): Promise<boolean> => {
    setIsChoosing(true);
    setError(null);
    try {
      const result = await globalThis.electronAPI.selectExistingLocalStore();
      if (!result?.success || !result.path) {
        if (result?.error && result.error !== "Selection cancelled") {
          setError(result.error);
        }
        return false;
      }
      if (!(await saveLocalStorePath(result.path))) {
        setError(LOCAL_STORE_SETTING_NOT_SAVED);
        return false;
      }
      return true;
    } catch (error_) {
      console.error("Failed to choose a local store:", error_);
      setError("Couldn't open the folder picker. Try again.");
      return false;
    } finally {
      setIsChoosing(false);
    }
  }, [saveLocalStorePath]);

  const clearError = useCallback(() => setError(null), []);

  return { chooseExistingStore, clearError, error, isChoosing };
}
