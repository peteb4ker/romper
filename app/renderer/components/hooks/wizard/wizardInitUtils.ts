import { CARD_NOT_RESPONDING_SETUP_MESSAGE } from "@romper/shared/cardMessages";

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

/**
 * Verify the target is approved, holds no local store yet, is writable, and
 * has enough space for the chosen source. Runs before setup writes anything.
 * Main only lets the wizard use a folder the user picked or confirmed, so a
 * typed path is confirmed first (RE-03); main won't even probe it before.
 */
export async function runPreChecks(
  api: ElectronAPI,
  targetPath: string,
  source: LocalStoreSource,
) {
  if (api.requestLocalStoreAccess) {
    const access = await api.requestLocalStoreAccess(targetPath);
    if (!access.granted) {
      throw new Error(
        access.error ??
          `Romper wasn't given permission to use ${targetPath}. Choose another folder.`,
      );
    }
  }

  // Setting up over an existing store would clash with (and, before RE-10,
  // delete) it; send the user to "Choose Existing Store" instead
  if (api.checkExistingLocalStore) {
    const existing = await api.checkExistingLocalStore(targetPath);
    if (existing.exists) {
      throw new Error(
        existing.error ??
          "This folder already contains a Romper local store (.romperdb).",
      );
    }
  }

  if (api.checkPathWritable) {
    const writableResult = await api.checkPathWritable(targetPath);
    if (!writableResult.writable) {
      throwIfCardNotResponding(writableResult.error);
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
      throwIfCardNotResponding(spaceResult.error);
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

/**
 * Main gave up on a folder that stopped responding (a card, #724): say so,
 * rather than that the folder can't be written or is full
 */
function throwIfCardNotResponding(error: string | undefined) {
  if (error === CARD_NOT_RESPONDING_SETUP_MESSAGE) throw new Error(error);
}
