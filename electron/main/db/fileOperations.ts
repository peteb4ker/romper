// File operations utilities for database management
import * as fs from "fs";

// Logging utilities
const log = {
  info: (message: string, ...args: any[]) =>
    console.log(`[Romper Electron] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[Romper Electron] ${message}`, ...args),
};

// Helper to wait between retry attempts
async function waitForRetry(
  attempt: number,
  isWindows: boolean,
  isRenameFailure: boolean = false,
): Promise<void> {
  if (isWindows) {
    if (isRenameFailure) {
      // Wait progressively longer after rename failures
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    } else if (attempt > 0) {
      // Standard Windows retry delay
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  } else if (attempt < 14) {
    // maxRetries - 1
    // Non-Windows platforms
    await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
  }
}

// Helper to attempt deletion and verify
async function tryDelete(dbPath: string, attempt: number): Promise<boolean> {
  fs.unlinkSync(dbPath);
  log.info(`Successfully deleted DB file on attempt ${attempt + 1}`);

  if (!fs.existsSync(dbPath)) {
    log.info(`Verified DB file is deleted`);
    return true;
  }

  log.info(`File still exists after deletion, retrying...`);
  throw new Error("File still exists after deletion");
}

// Helper to attempt rename and verify
async function tryRename(
  dbPath: string,
  attempt: number,
  suffix: string = "corrupted",
): Promise<boolean> {
  const backupPath = `${dbPath}.${suffix}.${Date.now()}.${attempt}`;
  fs.renameSync(dbPath, backupPath);
  log.info(`Successfully renamed DB file to backup on attempt ${attempt + 1}`);

  if (!fs.existsSync(dbPath)) {
    log.info(`Verified original DB file is gone after rename`);
    return true;
  }

  log.info(`Original file still exists after rename, retrying...`);
  throw new Error("Original file still exists after rename");
}

// Helper for Windows rename fallback
async function tryWindowsRenameFallback(
  dbPath: string,
  attempt: number,
): Promise<boolean> {
  try {
    return await tryRename(dbPath, attempt);
  } catch {
    log.info(`Rename attempt ${attempt + 1} failed, waiting...`);
    await waitForRetry(attempt, true, true);
    return false;
  }
}

// Helper for final Windows rename attempt
function finalWindowsRename(dbPath: string): void {
  try {
    const timestamp = Date.now();
    const backupPath = `${dbPath}.locked.${timestamp}`;
    fs.renameSync(dbPath, backupPath);
    log.info("Final rename attempt succeeded");

    if (!fs.existsSync(dbPath)) {
      log.info(`Verified original DB file is gone after final rename`);
      return;
    }
  } catch {
    log.error("All deletion/rename attempts failed, proceeding anyway");
    return;
  }
}

export async function deleteDbFileWithRetry(
  dbPath: string,
  maxRetries = 15,
): Promise<void> {
  let lastError: Error | null = null;
  const isWindows = process.platform === "win32";

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Wait before retry on Windows
      if (isWindows && i > 0) {
        await waitForRetry(i, isWindows);
      }

      // Try to delete the file
      if (await tryDelete(dbPath, i)) {
        return;
      }
    } catch (error) {
      lastError = error as Error;
      log.info(`Delete attempt ${i + 1} failed:`, lastError.message);

      // On Windows, try rename as fallback
      if (isWindows && i < maxRetries - 1) {
        if (await tryWindowsRenameFallback(dbPath, i)) {
          return;
        }
      } else {
        // Wait before next attempt on non-Windows
        await waitForRetry(i, isWindows);
      }
    }
  }

  // Final Windows fallback attempt
  if (isWindows) {
    finalWindowsRename(dbPath);
    return; // Always return on Windows after final attempt
  }

  throw lastError || new Error("Could not delete or rename database file");
}
