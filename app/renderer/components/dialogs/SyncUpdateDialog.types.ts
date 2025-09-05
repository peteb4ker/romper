export interface SyncChangeSummary {
  fileCount: number;
  kitCount: number;
}

export interface SyncErrorDetails {
  canRetry: boolean;
  error: string;
  fileName: string;
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
  error?: string;
  errorDetails?: SyncErrorDetails;
  filesCompleted: number;
  status:
    | "completed"
    | "converting"
    | "copying"
    | "error"
    | "finalizing"
    | "preparing";
  totalBytes: number;
  totalFiles: number;
}

export interface SyncUpdateDialogProps {
  isLoading?: boolean;
  isOpen: boolean;
  kitName: string;
  localChangeSummary: null | SyncChangeSummary;
  onClose: () => void;
  onConfirm: (options: {
    sdCardPath: null | string;
    wipeSdCard: boolean;
  }) => void;
  onGenerateChangeSummary?: (
    sdCardPath: string,
  ) => Promise<null | SyncChangeSummary>;
  onSdCardPathChange?: (path: null | string) => void;
  sdCardPath?: null | string;
  syncProgress?: null | SyncProgress;
}

export interface SyncValidationError {
  error: string;
  filename: string;
  sourcePath: string;
  type: "access_denied" | "invalid_format" | "missing_file" | "other";
}
