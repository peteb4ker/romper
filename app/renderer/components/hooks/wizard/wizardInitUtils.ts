import type { ElectronAPI } from "../../../electron.d";

import { type LocalStoreSource } from "./useLocalStoreWizardState";

/**
 * Pure helpers for the local store wizard's initialization flow.
 */

export function getElectronAPI(): ElectronAPI {
  // Use type assertion to avoid type conflict with window.electronAPI
  return typeof globalThis !== "undefined" && globalThis.electronAPI
    ? globalThis.electronAPI
    : ({} as ElectronAPI);
}

/** Map low-level error strings to actionable user-facing messages */
export function normalizeErrorMessage(msg: string) {
  if (msg.includes("premature close")) {
    return "Download failed: The connection was closed before completion. Please check your internet connection and try again.";
  }
  return msg;
}

/** Verify the target is writable and has enough space for the chosen source */
export async function runPreChecks(
  api: ElectronAPI,
  targetPath: string,
  source: LocalStoreSource,
) {
  if (api.checkPathWritable) {
    const writableResult = await api.checkPathWritable(targetPath);
    if (!writableResult.writable) {
      throw new Error(
        `Cannot write to ${targetPath}. Please choose a folder you have permission to write to.`,
      );
    }
  }

  if (api.checkDiskSpace && source !== "blank") {
    const requiredBytes =
      source === "squarp" ? 1024 * 1024 * 1024 : 500 * 1024 * 1024;
    const spaceResult = await api.checkDiskSpace(targetPath, requiredBytes);
    if (!spaceResult.sufficient) {
      const availableMB = Math.round(
        spaceResult.availableBytes / (1024 * 1024),
      );
      const requiredMB = Math.round(spaceResult.requiredBytes / (1024 * 1024));
      throw new Error(
        `Not enough disk space. Need ~${requiredMB} MB but only ${availableMB} MB available at ${targetPath}.`,
      );
    }
  }
}
