import type {
  FoundFile,
  MissingFileSearch,
  RestoredMissingFile,
} from "@romper/shared/electronApi";
import type { RestoreMissingFileAction } from "@romper/shared/undoTypes";

import { describeRestoredMissingFile } from "@romper/shared/storeCheckWording";
import { createActionId } from "@romper/shared/undoTypes";

import {
  ADD_UNDO_ACTION_EVENT,
  requestKitRefresh,
} from "./removeMissingSamples";

/** The undo entry for a found file put back (#823) */
export function restoreAction(
  kitName: string,
  restored: RestoredMissingFile,
): RestoreMissingFileAction {
  return {
    data: { kitName, restored },
    description: describeRestoredMissingFile(restored.kind, restored.fileName),
    id: createActionId(),
    timestamp: new Date(),
    type: "RESTORE_MISSING_FILE",
  };
}

/** The found file a restore used: what redo puts back again */
export function restoredFoundPath(restored: RestoredMissingFile): string {
  return restored.kind === "copy" ? restored.foundPath : restored.to;
}

/**
 * Put a found file back for a missing sample (#823, stage 6 of
 * docs/developer/store-check.md): copied to its old place in the store, or
 * the sample pointed at it (D2). Main checks everything again first and
 * then checks the kit again, so its badge, the status bar and the Library
 * check follow. The kit is reloaded and one undo entry goes on the undo
 * stack. Resolves to main's error, shown as the kit editor shows main's
 * scan errors (#821), or null.
 */
export async function restoreFoundFile(
  kitName: string,
  file: MissingFileSearch,
  found: FoundFile,
): Promise<null | string> {
  const result = await globalThis.electronAPI?.restoreMissingFile?.(kitName, {
    foundPath: found.path,
    kind: "restore",
    sampleId: file.sampleId,
  });
  if (!result?.success || !result.data?.restored) {
    return result?.error ?? null;
  }
  document.dispatchEvent(
    new CustomEvent(ADD_UNDO_ACTION_EVENT, {
      detail: restoreAction(kitName, result.data.restored),
    }),
  );
  requestKitRefresh(kitName);
  return null;
}
