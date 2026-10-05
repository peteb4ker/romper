export type {
  SyncBankSummary,
  SyncChangeSummary,
  SyncValidationError,
} from "@romper/shared/electronApi.js";

import type { SyncChangeSummary } from "@romper/shared/electronApi.js";

export interface SyncErrorDetails {
  canRetry: boolean;
  error: string;
  fileName: string;
  kitName?: string;
  operation: "convert" | "copy";
}

export interface SyncFileOperation {
  destinationPath: string;
  filename: string;
  operation: "convert" | "copy";
  originalFormat?: string;
  reason?: string;
  sourcePath: string;
  targetFormat?: string;
}

export interface SyncProgress {
  bytesCompleted: number;
  currentFile: string;
  currentKitName?: string;
  error?: string;
  errorDetails?: SyncErrorDetails;
  filesCompleted: number;
  /**
   * While status is "removing": entries removed from the card so far, of
   * those the store no longer has (#653)
   */
  removal?: { completed: number; total: number };
  status:
    | "cancelled"
    | "completed"
    | "converting"
    | "copying"
    | "error"
    | "finalizing"
    | "preparing"
    | "removing";
  totalBytes: number;
  totalFiles: number;
}

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
  syncProgress?: null | SyncProgress;
}
