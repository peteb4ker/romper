/**
 * In-app auto-update wiring.
 *
 * macOS only at this time:
 *   - Windows release artifacts currently ship unsigned (see issue #276) and
 *     Squirrel.Windows refuses unsigned updates, so enabling it there would
 *     fail or warn. Track Windows auto-update behind Azure Trusted Signing.
 *   - update.electronjs.org does not support Linux; Linux stays on the
 *     deb/rpm package managers.
 *
 * The updater is a no-op in dev / unpackaged builds (Squirrel is not present),
 * and `update-electron-app` is dynamically imported only once the macOS +
 * packaged guards pass, so it never loads during unit/e2e runs.
 */

import { app } from "electron";

import { logger } from "./utils/logger.js";

// GitHub repo backing the update.electronjs.org feed. Passed explicitly so the
// updater does not depend on package.json's `repository` field being present.
const GITHUB_REPO = "peteb4ker/romper";

// Conservative cadence for a desktop app: checks on launch, then hourly.
const UPDATE_INTERVAL = "1 hour";

/**
 * Initialise auto-update. Safe to call unconditionally on every platform —
 * it returns early everywhere except packaged macOS builds.
 */
export async function initAutoUpdater(): Promise<void> {
  if (process.platform !== "darwin") {
    logger.log(
      "[AutoUpdate] Skipped: auto-update is macOS-only at this time (see #276)",
    );
    return;
  }

  if (!app.isPackaged) {
    logger.log("[AutoUpdate] Skipped: not a packaged build");
    return;
  }

  try {
    const { updateElectronApp, UpdateSourceType } =
      await import("update-electron-app");

    updateElectronApp({
      logger: {
        error: (message: string) => console.error("[AutoUpdate]", message),
        info: (message: string) => logger.log("[AutoUpdate]", message),
        log: (message: string) => logger.log("[AutoUpdate]", message),
        warn: (message: string) => console.warn("[AutoUpdate]", message),
      },
      notifyUser: true,
      updateInterval: UPDATE_INTERVAL,
      updateSource: {
        repo: GITHUB_REPO,
        type: UpdateSourceType.ElectronPublicUpdateService,
      },
    });

    logger.log("[AutoUpdate] Initialised (macOS, packaged)");
  } catch (error: unknown) {
    // Never let an updater failure take down app startup.
    console.error(
      "[AutoUpdate] Failed to initialise auto-update:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
