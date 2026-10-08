import * as fs from "node:fs";
import * as path from "node:path";

import {
  CARD_NOT_RESPONDING_SETUP_MESSAGE,
  CardNotRespondingError,
  withCardWatchdog,
} from "../services/cardWatchdog.js";

/**
 * Shared file system utilities to reduce duplication across services
 */

/**
 * Common path operations for services
 */
export class ServicePathManager {
  /**
   * Get database path from local store path
   */
  static getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
  }

  /**
   * Get the effective local store path: the ROMPER_LOCAL_PATH environment
   * override if set, otherwise the saved setting. Every main-process reader
   * of the local store path should go through this.
   */
  static getLocalStorePath(
    inMemorySettings: Record<string, unknown>,
  ): null | string {
    const envOverride = process.env.ROMPER_LOCAL_PATH;
    if (envOverride && envOverride.trim() !== "") {
      return envOverride;
    }
    const path = inMemorySettings.localStorePath;
    return typeof path === "string" && path.trim() !== "" ? path : null;
  }
}

/**
 * Checks available disk space at a given path.
 *
 * Asynchronous and under the card watchdog (#724): the setup wizard checks
 * the folder it's setting up in, which could be on a card whose driver
 * stopped responding (#653). That fails the check with the
 * card-not-responding message instead of blocking the main process.
 */
export async function checkDiskSpace(targetPath: string): Promise<{
  availableBytes: number;
  error?: string;
  requiredBytes?: number;
  sufficient: boolean;
}> {
  try {
    const resolvedPath = (await statIfExists(targetPath))
      ? targetPath
      : path.dirname(targetPath);

    if (!(await statIfExists(resolvedPath))) {
      return {
        availableBytes: 0,
        error: "Path does not exist",
        sufficient: false,
      };
    }

    const stats = await withCardWatchdog(fs.promises.statfs(resolvedPath));
    const availableBytes = stats.bavail * stats.bsize;
    return { availableBytes, sufficient: true };
  } catch (error) {
    return {
      availableBytes: 0,
      error: checkFailure("Disk space check failed", error),
      sufficient: false,
    };
  }
}

/**
 * Checks available disk space against a required amount
 */
export async function checkDiskSpaceSufficient(
  targetPath: string,
  requiredBytes: number,
): Promise<{
  availableBytes: number;
  error?: string;
  requiredBytes: number;
  sufficient: boolean;
}> {
  const result = await checkDiskSpace(targetPath);
  if (result.error) {
    return { ...result, requiredBytes, sufficient: false };
  }
  return {
    availableBytes: result.availableBytes,
    requiredBytes,
    sufficient: result.availableBytes >= requiredBytes,
  };
}

/**
 * Checks if a path is writable by attempting to create and remove a temp
 * file. Asynchronous and under the card watchdog, like checkDiskSpace
 * (#724).
 */
export async function checkPathWritable(targetPath: string): Promise<{
  error?: string;
  writable: boolean;
}> {
  try {
    const dirToCheck = (await statIfExists(targetPath))?.isDirectory()
      ? targetPath
      : path.dirname(targetPath);

    if (!(await statIfExists(dirToCheck))) {
      return {
        error: `Directory does not exist: ${dirToCheck}`,
        writable: false,
      };
    }

    const testFile = path.join(dirToCheck, `.romper-write-test-${Date.now()}`);
    await withCardWatchdog(fs.promises.writeFile(testFile, ""));
    await withCardWatchdog(fs.promises.unlink(testFile));
    return { writable: true };
  } catch (error) {
    return {
      error: checkFailure("Cannot write to path", error),
      writable: false,
    };
  }
}

/**

/**
 * Why a check failed: setup's card-not-responding message (#724), or any
 * other failure after `prefix`
 */
function checkFailure(prefix: string, error: unknown): string {
  if (error instanceof CardNotRespondingError) {
    return CARD_NOT_RESPONDING_SETUP_MESSAGE;
  }
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${message}`;
}

/**
 * `p`'s stats, or null if it can't be read (as `existsSync` would say it
 * doesn't exist). A card that stopped responding still fails, so the
 * caller can say so.
 */
async function statIfExists(p: string): Promise<fs.Stats | null> {
  try {
    return await withCardWatchdog(fs.promises.stat(p));
  } catch (error) {
    if (error instanceof CardNotRespondingError) throw error;
    return null;
  }
}
