import { getAudioMetadata } from "../audioUtils.js";

/**
 * Shared stereo processing utilities to reduce duplication in sample operations
 */

export interface StereoOptions {
  forceMono?: boolean;
  forceStereo?: boolean;
}

/**
 * Determines stereo configuration for a sample based on settings and overrides
 * Extracted from sampleService to reduce duplication between addSampleToSlot and replaceSampleInSlot
 */
export function determineStereoConfiguration(
  filePath: string,
  inMemorySettings: Record<string, unknown>,
  options?: StereoOptions,
): boolean {
  let isStereo = false;

  // Get the defaultToMonoSamples setting (default: true)
  const defaultToMonoSamples = inMemorySettings.defaultToMonoSamples ?? true;

  // Check for per-sample override first
  if (options?.forceMono) {
    // isStereo already false, no assignment needed
  } else if (options?.forceStereo) {
    // Force stereo even if file is mono - will be handled during preview/sync
    isStereo = true;
  } else if (!defaultToMonoSamples) {
    // Only check if file is actually stereo when setting is OFF and no override
    const metadataResult = getAudioMetadata(filePath);
    if (metadataResult.success && metadataResult.data) {
      isStereo = (metadataResult.data.channels || 1) > 1;
    }
  }
  // If defaultToMonoSamples is true and no override, isStereo remains false

  return isStereo;
}
