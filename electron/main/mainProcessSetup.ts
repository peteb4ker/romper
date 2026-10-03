import fs from "node:fs";

import type { InMemorySettings } from "./types/settings.js";

import { validateLocalStoreAndDb } from "./localStoreValidator.js";
import { normalizeSettings } from "./settingsFile.js";
import { logger } from "./utils/logger.js";

export interface WindowState {
  height: number;
  isMaximized?: boolean;
  width: number;
  x?: number;
  y?: number;
}

export function loadSettings(settingsPath: string): InMemorySettings {
  logger.log("[Settings] Loading settings from:", settingsPath);

  if (!fs.existsSync(settingsPath)) {
    logger.log("[Settings] Settings file not found - will use empty settings");
    return { localStorePath: null };
  }

  let settings: InMemorySettings = { localStorePath: null };
  try {
    const fileContent = fs.readFileSync(settingsPath, "utf-8");

    if (fileContent.length === 0) {
      logger.log("[Settings] Settings file is empty - using empty settings");
      return { localStorePath: null };
    }

    const parsed = JSON.parse(fileContent);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // Every saved setting, not only the paths: theme and "confirm
      // destructive actions" reset on each launch and were erased by the
      // next write when only the paths were loaded (RE-21)
      settings = normalizeSettings(parsed);
      logger.log(
        "[Settings] Loaded settings:",
        JSON.stringify(settings, null, 2),
      );
    } else {
      console.warn(
        "[Settings] Settings file did not contain an object. Using empty settings.",
      );
      console.warn(
        "[Settings] Parsed type:",
        typeof parsed,
        "Is array:",
        Array.isArray(parsed),
      );
    }
  } catch (error) {
    console.error("[Settings] Failed to parse settings file:", error);
    console.error("[Settings] Using empty settings");
  }

  return settings;
}

export function loadWindowState(statePath: string): WindowState {
  const defaults: WindowState = { height: 800, width: 1200 };
  try {
    if (fs.existsSync(statePath)) {
      const data = JSON.parse(fs.readFileSync(statePath, "utf-8"));
      return { ...defaults, ...data };
    }
  } catch {
    // Ignore corrupt state file
  }
  return defaults;
}

export function saveWindowState(
  bounds: { height: number; width: number; x: number; y: number },
  isMaximized: boolean,
  statePath: string,
): void {
  try {
    const state: WindowState = {
      height: bounds.height,
      isMaximized,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
    };
    fs.writeFileSync(statePath, JSON.stringify(state));
  } catch {
    // Ignore write errors
  }
}

/**
 * Check the saved local store at startup. An invalid store is reported
 * (the renderer shows the Invalid Local Store dialog) but never forgotten:
 * it may be on a drive that isn't connected yet (RE-80).
 */
export function validateSavedLocalStore(
  settings: InMemorySettings,
  envOverridePath?: string,
): InMemorySettings {
  logger.log("[Validation] Starting local store validation");

  if (envOverridePath) {
    logger.log("[Validation] Environment override detected:", envOverridePath);
    const envValidation = validateLocalStoreAndDb(envOverridePath);
    logger.log("[Validation] Environment override validation result:", {
      error: envValidation.error,
      errorSummary: envValidation.errorSummary,
      isValid: envValidation.isValid,
    });

    if (envValidation.isValid) {
      logger.log("[Validation] ✓ Environment override path is valid");
      return settings;
    } else {
      console.warn("[Validation] ✗ Environment override path is invalid");
      console.warn("  - Path:", envOverridePath);
      console.warn("  - Error:", envValidation.error);
    }
  }

  logger.log(
    "[Validation] Settings have localStorePath:",
    !!settings.localStorePath,
  );

  if (settings.localStorePath) {
    logger.log(
      "[Validation] Validating local store path:",
      settings.localStorePath,
    );
    const validation = validateLocalStoreAndDb(settings.localStorePath);
    logger.log("[Validation] Validation result:", {
      error: validation.error,
      errorSummary: validation.errorSummary,
      isValid: validation.isValid,
    });

    if (validation.isValid) {
      logger.log("[Validation] ✓ Local store path is valid");
    } else {
      // Keep the saved path (RE-80). The store may be on a drive that isn't
      // connected yet; forgetting it would send the user to the first-run
      // wizard. The renderer shows the Invalid Local Store dialog instead,
      // where they can try again, choose another folder or set up a new one.
      console.warn("[Startup] ✗ Saved local store can't be opened");
      console.warn("  - Path:", settings.localStorePath);
      console.warn("  - Error:", validation.error);
    }
  } else {
    logger.log("[Validation] No local store path to validate");
  }

  return settings;
}
