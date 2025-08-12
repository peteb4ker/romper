// File operations utilities for database management
import * as fs from "fs";

// Logging utilities
const log = {
  error: (message: string, ...args: any[]) =>
    console.error(`[Romper Electron] ${message}`, ...args),
  info: (message: string, ...args: any[]) =>
    console.log(`[Romper Electron] ${message}`, ...args),
};

export async function deleteDbFileWithRetry(
  dbPath: string,
  maxRetries = 15,
): Promise<void> {
  let lastError: Error | null = null;
  const isWindows = process.platform === "win32";
  const startTime = Date.now();
  
  console.log(`[DELETE] deleteDbFileWithRetry: Starting deletion of ${dbPath} (Windows: ${isWindows}, maxRetries: ${maxRetries})`);

  for (let i = 0; i < maxRetries; i++) {
    const attemptStart = Date.now();
    console.log(`[DELETE] deleteDbFileWithRetry: Attempt ${i + 1}/${maxRetries} for ${dbPath}`);
    
    try {
      const success = await handleDeleteAttempt(
        dbPath,
        i,
        isWindows,
        i === maxRetries - 1,
      );
      
      const attemptDuration = Date.now() - attemptStart;
      
      if (success) {
        const totalDuration = Date.now() - startTime;
        console.log(`[DELETE] deleteDbFileWithRetry: Successfully deleted ${dbPath} on attempt ${i + 1} (attempt: ${attemptDuration}ms, total: ${totalDuration}ms)`);
        return;
      } else {
        console.log(`[DELETE] deleteDbFileWithRetry: Attempt ${i + 1} unsuccessful after ${attemptDuration}ms, continuing...`);
      }
    } catch (error) {
      lastError = error as Error;
      const attemptDuration = Date.now() - attemptStart;
      console.log(`[DELETE] deleteDbFileWithRetry: Attempt ${i + 1} failed after ${attemptDuration}ms:`, error.message);
    }
  }

  // Final Windows fallback attempt
  if (isWindows) {
    console.log(`[DELETE] deleteDbFileWithRetry: All ${maxRetries} attempts failed, trying final Windows rename fallback`);
    const fallbackStart = Date.now();
    try {
      finalWindowsRename(dbPath);
      const fallbackDuration = Date.now() - fallbackStart;
      const totalDuration = Date.now() - startTime;
      console.log(`[DELETE] deleteDbFileWithRetry: Final Windows rename completed in ${fallbackDuration}ms (total: ${totalDuration}ms)`);
      return; // Always return on Windows after final attempt
    } catch (error) {
      const fallbackDuration = Date.now() - fallbackStart;
      console.error(`[DELETE] deleteDbFileWithRetry: Final Windows rename failed after ${fallbackDuration}ms:`, error);
    }
  }

  const totalDuration = Date.now() - startTime;
  console.error(`[DELETE] deleteDbFileWithRetry: Failed to delete ${dbPath} after ${totalDuration}ms and ${maxRetries} attempts`);
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
  console.log(`[DELETE] handleDeleteAttempt: Starting attempt ${attempt + 1} for ${dbPath} (Windows: ${isWindows}, lastAttempt: ${isLastAttempt})`);
  
  try {
    // Wait before retry on Windows
    if (isWindows && attempt > 0) {
      console.log(`[DELETE] handleDeleteAttempt: Windows platform, waiting before retry attempt ${attempt + 1}`);
      await waitForRetry(attempt, isWindows);
    }

    // Try to delete the file
    console.log(`[DELETE] handleDeleteAttempt: Attempting actual file deletion for ${dbPath}`);
    const deleteResult = await tryDelete(dbPath, attempt);
    console.log(`[DELETE] handleDeleteAttempt: Delete attempt ${attempt + 1} result: ${deleteResult}`);
    return deleteResult;
  } catch (error) {
    const err = error as Error;
    console.log(`[DELETE] handleDeleteAttempt: Delete attempt ${attempt + 1} failed:`, err.message);
    log.info(`Delete attempt ${attempt + 1} failed:`, err.message);

    // Handle Windows fallback
    if (isWindows && !isLastAttempt) {
      console.log(`[DELETE] handleDeleteAttempt: Windows platform, trying rename fallback for attempt ${attempt + 1}`);
      const fallbackResult = await tryWindowsRenameFallback(dbPath, attempt);
      console.log(`[DELETE] handleDeleteAttempt: Windows rename fallback result: ${fallbackResult}`);
      return fallbackResult;
    }

    // Wait before next attempt on non-Windows
    if (!isWindows) {
      console.log(`[DELETE] handleDeleteAttempt: Non-Windows platform, waiting before next attempt`);
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
    console.log(`[DELETE] waitForRetry: Waiting ${delay}ms before retry attempt ${attempt + 1} (Windows: ${isWindows}, renameFailure: ${isRenameFailure})`);
    const waitStart = Date.now();
    await new Promise((resolve) => setTimeout(resolve, delay));
    const waitDuration = Date.now() - waitStart;
    console.log(`[DELETE] waitForRetry: Wait completed after ${waitDuration}ms`);
  } else {
    console.log(`[DELETE] waitForRetry: No delay needed for attempt ${attempt + 1}`);
  }
}
