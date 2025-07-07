// Shared database types for both main and renderer processes

/**
 * Generic database result interface
 */
export interface DbResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Sample record interface
 */
export interface SampleRecord {
  kit_name: string;
  filename: string;
  voice_number: number;
  slot_number: number;
  is_stereo: boolean;
  wav_bitrate?: number;
  wav_sample_rate?: number;
}

/**
 * Kit record interface
 */
export interface KitRecord {
  name: string;
  alias?: string;
  artist?: string;
  plan_enabled: boolean;
  locked?: boolean;
  step_pattern?: number[][] | null;
}

/**
 * Voice record interface
 */
export interface VoiceRecord {
  kit_name: string;
  voice_number: number;
  voice_alias?: string;
}

/**
 * Kit with voices interface
 */
export interface KitWithVoices {
  name: string;
  alias?: string;
  artist?: string;
  plan_enabled: boolean;
  locked: boolean;
  step_pattern?: number[][] | null;
  voices: { [voiceNumber: number]: string };
}

/**
 * Validation error for a kit
 */
export interface KitValidationError {
  kitName: string;
  missingFiles: string[];
  extraFiles: string[];
}

/**
 * Detailed result of local store validation
 */
export interface LocalStoreValidationDetailedResult {
  isValid: boolean;
  errors?: KitValidationError[];
  errorSummary?: string;
  error?: string;
  romperDbPath?: string;
  hasLocalStore?: boolean;
  localStorePath?: string | null;
}
