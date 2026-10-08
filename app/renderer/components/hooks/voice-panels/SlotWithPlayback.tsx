import type React from "react";

import {
  type SlotPlayback,
  type SlotPlaybackStore,
  useSlotPlayback,
} from "../kit-management/slotPlaybackStore";

interface SlotWithPlaybackProps {
  children: (playback: SlotPlayback) => React.ReactElement;
  slotKey: string;
  store: SlotPlaybackStore;
}

/**
 * Renders a slot from its own playback. It subscribes to that slot alone,
 * so a trigger re-renders the slots it plays or stops, and not the voice
 * panels, the other slots or the sequencer (#482).
 */
export function SlotWithPlayback({
  children,
  slotKey,
  store,
}: SlotWithPlaybackProps) {
  return children(useSlotPlayback(store, slotKey));
}
