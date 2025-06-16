// Handles Romper DB (SQLite) IPC calls from the renderer
// All DB-related business logic for UI components should use this hook
import { useCallback } from "react";

export function useDb() {
  // Create and initialize the Romper DB in the given directory
  const createRomperDb = useCallback(async (dbDir: string) => {
    if (!window.electronAPI?.createRomperDb) {
      throw new Error("Romper DB creation not available");
    }
    const result = await window.electronAPI.createRomperDb(dbDir);
    if (!result.success) {
      throw new Error(result.error || "Failed to create Romper DB");
    }
    return result.dbPath;
  }, []);

  // Add more DB-related IPC calls here as needed

  return {
    createRomperDb,
  };
}
