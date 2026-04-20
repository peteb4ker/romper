/**
 * Shared audio format types used across main and renderer processes.
 *
 * These live in shared/ so the renderer does not have to reach into
 * electron/main/ — the renderer and preload are permitted to import
 * from @romper/shared, but not from @romper/electron.
 */

/**
 * Audio file metadata extracted from a WAV header.
 */
export interface AudioMetadata {
  bitDepth?: number;
  channels?: number;
  duration?: number;
  fileSize?: number;
  sampleRate?: number;
}

/**
 * Specific format issue with type and description.
 */
export interface FormatIssue {
  current?: number | string;
  message: string;
  required?: number | readonly (number | string)[] | string;
  type:
    | "bitDepth"
    | "channels"
    | "extension"
    | "fileAccess"
    | "invalidFormat"
    | "sampleRate";
}

/**
 * Format validation result for a sample file.
 */
export interface FormatValidationResult {
  issues: FormatIssue[];
  isValid: boolean;
  metadata?: AudioMetadata;
}
