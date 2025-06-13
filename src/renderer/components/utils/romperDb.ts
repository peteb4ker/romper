// Handles Romper DB (SQLite) operations for plans, kits, and samples.
// This is a stub for initial DB creation logic for 2.2

export async function createRomperDb(dbDir: string) {
  if (!window.electronAPI?.createRomperDb) {
    throw new Error("Romper DB creation not available");
  }
  const result = await window.electronAPI.createRomperDb(dbDir);
  if (!result.success) {
    throw new Error(result.error || "Failed to create Romper DB");
  }
  return result.dbPath;
}
