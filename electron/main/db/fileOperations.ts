// File operations utilities for database management
import * as fs from "fs";

// Logging utilities
const log = {
  error: (message: string, ...args: unknown[]) =>
    console.error(`[Romper Electron] ${message}`, ...args),
  info: (message: string, ...args: unknown[]) =>
    console.log(`[Romper Electron] ${message}`, ...args),
};

export async function deleteDbFileWithRetry(
  dbPath: string,
  maxRetries = 15,
): Promise<void> {
  let lastError: Error | null = null;
  const isWindows = process.platform === "win32";

  for (let i = 0; i < maxRetries; i++) {
    try {
      const success = await handleDeleteAttempt(
        dbPath,
        i,
        isWindows,
        i === maxRetries - 1,
      );
      if (success) {
        return;
      }
    } catch (error) {
      lastError = error as Error;
    }
  }

  // Final Windows fallback attempt
  if (isWindows) {
    finalWindowsRename(dbPath);
    return; // Always return on Windows after final attempt
  }

  throw lastError || new Error("Could not delete or rename database file");
}

// Calculate retry delay based on platform and failure type
function calculateRetryDelay(
  attempt: number,
  isWindows: boolean,
  isRenameFailure: boolean = false,
): number {
  if (!isWindows) {
    // Non-Windows platforms
    return attempt < 14 ? 100 * (attempt + 1) : 0;
  }

  // Windows platform
  if (isRenameFailure) {
    // Wait progressively longer after rename failures
    return 500 * (attempt + 1);
  }

  // Standard Windows retry delay
  return attempt > 0 ? 200 * attempt : 0;
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

// Handle deletion attempt with appropriate retry logic
async function handleDeleteAttempt(
  dbPath: string,
  attempt: number,
  isWindows: boolean,
  isLastAttempt: boolean,
): Promise<boolean> {
  try {
    // Wait before retry on Windows
    if (isWindows && attempt > 0) {
      await waitForRetry(attempt, isWindows);
    }

    // Try to delete the file
    return await tryDelete(dbPath, attempt);
  } catch (error) {
    const err = error as Error;
    log.info(`Delete attempt ${attempt + 1} failed:`, err.message);

    // Handle Windows fallback
    if (isWindows && !isLastAttempt) {
      return await tryWindowsRenameFallback(dbPath, attempt);
    }

    // Wait before next attempt on non-Windows
    if (!isWindows) {
      await waitForRetry(attempt, isWindows);
    }

    throw err;
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

// Helper to wait between retry attempts
async function waitForRetry(
  attempt: number,
  isWindows: boolean,
  isRenameFailure: boolean = false,
): Promise<void> {
  const delay = calculateRetryDelay(attempt, isWindows, isRenameFailure);
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
