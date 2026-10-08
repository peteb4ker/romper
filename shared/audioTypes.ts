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
  /** Integer PCM or IEEE float samples */
  encoding?: "float" | "pcm";
  /** WAVE_FORMAT_EXTENSIBLE header (sync rewrites it as plain PCM) */
  extensible?: boolean;
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
    | "encoding"
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

/**
 * A slot's audio file, as `getSampleAudioBuffer` returns it (#478).
 *
 * `version` names the file as it is now: its path, size, modification time
 * and inode, so it changes when another file takes the slot or the file
 * itself is rewritten. `bytes` is null when the caller said it already
 * holds that version, so a kit you come back to costs no file reads.
 */
export interface SampleAudio {
  bytes: ArrayBuffer | null;
  version: string;
}
