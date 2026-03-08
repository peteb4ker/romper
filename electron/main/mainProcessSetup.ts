import fs from "fs";

import type { InMemorySettings } from "./types/settings.js";

import { validateLocalStoreAndDb } from "./localStoreValidator.js";

export interface WindowState {
  height: number;
  isMaximized?: boolean;
  width: number;
  x?: number;
  y?: number;
}

export function loadSettings(settingsPath: string): InMemorySettings {
  console.log("[Settings] Loading settings from:", settingsPath);

  if (!fs.existsSync(settingsPath)) {
    console.log("[Settings] Settings file not found - will use empty settings");
    return { localStorePath: null };
  }

  let settings: InMemorySettings = { localStorePath: null };
  try {
    const fileContent = fs.readFileSync(settingsPath, "utf-8");

    if (fileContent.length === 0) {
      console.log("[Settings] Settings file is empty - using empty settings");
      return { localStorePath: null };
    }

    const parsed = JSON.parse(fileContent);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      settings = {
        defaultToMonoSamples: parsed.defaultToMonoSamples,
        localStorePath: parsed.localStorePath || null,
        sdCardPath: parsed.sdCardPath,
      };
      console.log(
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

export function validateAndFixLocalStore(
  settings: InMemorySettings,
  settingsPath: string,
  envOverridePath?: string,
): InMemorySettings {
  console.log("[Validation] Starting local store validation");

  if (envOverridePath) {
    console.log("[Validation] Environment override detected:", envOverridePath);
    const envValidation = validateLocalStoreAndDb(envOverridePath);
    console.log("[Validation] Environment override validation result:", {
      error: envValidation.error,
      errorSummary: envValidation.errorSummary,
      isValid: envValidation.isValid,
    });

    if (envValidation.isValid) {
      console.log("[Validation] ✓ Environment override path is valid");
      return settings;
    } else {
      console.warn("[Validation] ✗ Environment override path is invalid");
      console.warn("  - Path:", envOverridePath);
      console.warn("  - Error:", envValidation.error);
    }
  }

  console.log(
    "[Validation] Settings have localStorePath:",
    !!settings.localStorePath,
  );

  if (settings.localStorePath) {
    console.log(
      "[Validation] Validating local store path:",
      settings.localStorePath,
    );
    const validation = validateLocalStoreAndDb(settings.localStorePath);
    console.log("[Validation] Validation result:", {
      error: validation.error,
      errorSummary: validation.errorSummary,
      isValid: validation.isValid,
    });

    if (!validation.isValid) {
      console.warn("[Startup] ✗ Saved local store path is invalid");
      console.warn("  - Path:", settings.localStorePath);
      console.warn("  - Error:", validation.error);
      console.warn("[Startup] Removing invalid path from settings...");

      settings.localStorePath = null;
      try {
        fs.writeFileSync(
          settingsPath,
          JSON.stringify(settings, null, 2),
          "utf-8",
        );
        console.log(
          "[Startup] Invalid local store path removed from settings file",
        );
      } catch (writeError) {
        console.error("[Startup] Failed to update settings file:", writeError);
      }
    } else {
      console.log("[Validation] ✓ Local store path is valid");
    }
  } else {
    console.log("[Validation] No local store path to validate");
  }

  return settings;
}
