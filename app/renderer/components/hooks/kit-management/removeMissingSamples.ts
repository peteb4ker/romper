import type { RemoveMissingSamplesAction } from "@romper/shared/undoTypes";

import { describeRemovedMissingSamples } from "@romper/shared/storeCheckWording";
import { createActionId } from "@romper/shared/undoTypes";

/**
 * The event that puts an undo entry on the kit view's undo stack from
 * outside it: the Library check dialog is mounted beside the kit view, not
 * in it (#822). `detail` is the action.
 */
export const ADD_UNDO_ACTION_EVENT = "romper:add-undo-action";

/**
 * Remove the kit's missing samples (#822, stage 5 of
 * docs/developer/store-check.md). Main checks each file again and removes
 * only the rows still missing, never one on a drive that isn't connected
 * (D6); main then checks the kit again, so its badge, the status bar and
 * the Library check follow. When something went, the kit is reloaded and
 * one undo entry goes on the undo stack. Resolves to main's error, shown
 * as the kit editor shows main's scan errors (#821), or null.
 */
export async function removeMissingSamplesFromKit(
  kitName: string,
): Promise<null | string> {
  const result = await globalThis.electronAPI?.removeMissingSamples?.(kitName);
  if (!result?.success || !result.data) return result?.error ?? null;
  const { samples, voicesBefore } = result.data;
  if (samples === 0) return null;
  const action: RemoveMissingSamplesAction = {
    data: { kitName, samples, voicesBefore },
    description: describeRemovedMissingSamples(samples, kitName),
    id: createActionId(),
    timestamp: new Date(),
    type: "REMOVE_MISSING_SAMPLES",
  };
  document.dispatchEvent(
    new CustomEvent(ADD_UNDO_ACTION_EVENT, { detail: action }),
  );
  requestKitRefresh(kitName);
  return null;
}

/**
 * Reload a kit's rows after its missing samples were removed or put back,
 * whether or not it is the kit open in the editor
 */
export function requestKitRefresh(kitName: string): void {
  document.dispatchEvent(
    new CustomEvent("romper:refresh-samples", {
      detail: { kitName, refreshAll: true },
    }),
  );
}
