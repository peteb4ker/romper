import React from "react";

import type { SyncProgressStore } from "../hooks/shared/syncProgressStore";
import type { SyncUpdateDialogProps } from "./SyncUpdateDialog.types";

import { useSyncProgress } from "../hooks/shared/syncProgressStore";
import SyncUpdateDialog from "./SyncUpdateDialog";

interface LiveSyncUpdateDialogProps extends Omit<
  SyncUpdateDialogProps,
  "syncProgress"
> {
  syncProgressStore: SyncProgressStore;
}

/**
 * The write panel, subscribed to write progress itself so that progress
 * updates re-render only the panel, not the kit browser around it (RE-61).
 */
const LiveSyncUpdateDialog: React.FC<LiveSyncUpdateDialogProps> = ({
  syncProgressStore,
  ...props
}) => {
  const syncProgress = useSyncProgress(syncProgressStore);
  return <SyncUpdateDialog {...props} syncProgress={syncProgress} />;
};

export default LiveSyncUpdateDialog;
