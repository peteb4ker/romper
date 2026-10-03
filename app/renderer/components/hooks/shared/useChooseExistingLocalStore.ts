import { useCallback, useState } from "react";

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
        setError("Couldn't save the local store setting. Try again.");
        return false;
      }
      return true;
    } catch (caught) {
      console.error("Failed to choose a local store:", caught);
      setError("Couldn't open the folder picker. Try again.");
      return false;
    } finally {
      setIsChoosing(false);
    }
  }, [saveLocalStorePath]);

  const clearError = useCallback(() => setError(null), []);

  return { chooseExistingStore, clearError, error, isChoosing };
}
