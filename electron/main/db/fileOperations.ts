// File operations utilities for database management
import * as fs from "fs";

// Logging utilities
const log = {
  info: (message: string, ...args: any[]) =>
    console.log(`[Romper Electron] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[Romper Electron] ${message}`, ...args),
};

export async function deleteDbFileWithRetry(
  dbPath: string,
  maxRetries = 15,
): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // On Windows, try unlinking after progressively longer delays
      if (process.platform === "win32" && i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200 * i));
      }

      fs.unlinkSync(dbPath);
      log.info(`Successfully deleted DB file on attempt ${i + 1}`);

      // Verify file is actually gone
      if (!fs.existsSync(dbPath)) {
        log.info(`Verified DB file is deleted`);
        return;
      } else {
        log.info(`File still exists after deletion, retrying...`);
        throw new Error("File still exists after deletion");
      }
    } catch (error) {
      lastError = error as Error;
      log.info(`Delete attempt ${i + 1} failed:`, lastError.message);

      // If deletion fails, try renaming first (common Windows issue)
      if (process.platform === "win32" && i < maxRetries - 1) {
        try {
          const backupPath = `${dbPath}.corrupted.${Date.now()}.${i}`;
          fs.renameSync(dbPath, backupPath);
          log.info(
            `Successfully renamed DB file to backup on attempt ${i + 1}`,
          );

          // Verify original file is gone
          if (!fs.existsSync(dbPath)) {
            log.info(`Verified original DB file is gone after rename`);
            return;
          } else {
            log.info(`Original file still exists after rename, retrying...`);
            throw new Error("Original file still exists after rename");
          }
        } catch {
          log.info(`Rename attempt ${i + 1} failed, waiting...`);
          // Wait progressively longer on Windows
          await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
        }
      } else if (i < maxRetries - 1) {
        // Wait and retry on other platforms
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }

  // On Windows, as a last resort, just rename the file to get it out of the way
  if (process.platform === "win32") {
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

  throw lastError || new Error("Could not delete or rename database file");
}
