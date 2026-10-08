export type {
  SyncBankSummary,
  SyncChangeSummary,
  SyncValidationError,
} from "@romper/shared/electronApi.js";

import type {
  SyncChangeSummary,
  SyncProgress,
} from "@romper/shared/electronApi.js";

export interface SyncFileOperation {
  destinationPath: string;
  filename: string;
  operation: "convert" | "copy";
  originalFormat?: string;
  reason?: string;
  sourcePath: string;
  targetFormat?: string;
}

/**
 * What the write panel shows: main's latest progress event (SyncProgress),
 * or the state the renderer sets before the first event ("preparing") and
 * once the write's result arrives ("cancelled", or "error" with `error`)
 */
export type SyncProgressState = {
  error?: string;
  status: "cancelled" | "preparing" | SyncProgress["status"];
} & Omit<SyncProgress, "elapsedTime" | "estimatedTimeRemaining" | "status">;

export interface SyncUpdateDialogProps {
  isLoading?: boolean;
  isOpen: boolean;
  kitName: string;
  localChangeSummary: null | SyncChangeSummary;
  /** Stop a write in progress (after the file being written) */
  onCancelSync?: () => void;
  onClose: () => void;
  onConfirm: (options: {
    sdCardPath: null | string;
    skipInvalidFiles: boolean;
  }) => void;
  onGenerateChangeSummary?: (
    sdCardPath: string,
  ) => Promise<null | SyncChangeSummary>;
  onSdCardPathChange?: (path: null | string) => void;
  sdCardPath?: null | string;
  syncProgress?: null | SyncProgressState;
}
