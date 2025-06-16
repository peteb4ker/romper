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

export async function insertKit(dbDir: string, kit: { name: string, alias?: string, artist?: string, plan_enabled: boolean }) {
  if (!window.electronAPI?.insertKit) throw new Error("IPC not available");
  const result = await window.electronAPI.insertKit(dbDir, kit);
  if (!result.success) throw new Error(result.error || "Failed to insert kit");
  return result.kitId;
}

export async function insertSample(dbDir: string, sample: { kit_id: number, filename: string, slot_number: number, is_stereo: boolean }) {
  if (!window.electronAPI?.insertSample) throw new Error("IPC not available");
  const result = await window.electronAPI.insertSample(dbDir, sample);
  if (!result.success) throw new Error(result.error || "Failed to insert sample");
  return result.sampleId;
}
