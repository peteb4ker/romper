import {
  BrowserWindow,
  dialog,
  type MessageBoxOptions,
  type WebContents,
} from "electron";
import * as os from "node:os";
import * as path from "node:path";

import { canonicalizePath, isSameOrInside, pathAccess } from "./pathAccess.js";

export interface LocalStoreAccessResult {
  error?: string;
  granted: boolean;
}

/**
 * Let the setup wizard use a folder the user typed rather than picked
 * (RE-03). Folders already inside an allowed root pass straight through.
 * Anything else needs the user's OK in a native prompt owned by main, which
 * shows the full path; the renderer can ask for the prompt but can't answer
 * it. The filesystem root, the home folder and the folders above it are
 * refused outright.
 */
export async function requestLocalStoreAccess(
  sender: undefined | WebContents,
  targetPath: unknown,
): Promise<LocalStoreAccessResult> {
  if ((await pathAccess.check(targetPath, "write")).ok) {
    return { granted: true };
  }

  let canonical: string;
  try {
    canonical = await canonicalizePath(targetPath);
  } catch (error) {
    return { error: (error as Error).message, granted: false };
  }
  const folder = targetPath as string;

  if (await isProtectedLocation(canonical)) {
    return {
      error: `Romper can't use ${folder} as a local store. Choose a folder of its own, such as one inside Documents.`,
      granted: false,
    };
  }

  const options: MessageBoxOptions = {
    buttons: ["Use This Folder", "Cancel"],
    cancelId: 1,
    defaultId: 0,
    detail: folder,
    message: "Create your Romper local store in this folder?",
    title: "Confirm Local Store Folder",
    type: "question",
  };
  const parent = sender ? BrowserWindow.fromWebContents(sender) : null;
  const { response } = parent
    ? await dialog.showMessageBox(parent, options)
    : await dialog.showMessageBox(options);

  if (response !== 0) {
    return {
      error: `Romper wasn't given permission to use ${folder}.`,
      granted: false,
    };
  }

  pathAccess.grantRoot(folder);
  return { granted: true };
}

async function isProtectedLocation(canonical: string): Promise<boolean> {
  if (path.dirname(canonical) === canonical) return true; // filesystem root
  let home: string;
  try {
    home = await canonicalizePath(os.homedir());
  } catch {
    return false;
  }
  // The home folder itself, or any folder that contains it.
  return isSameOrInside(home, canonical);
}
