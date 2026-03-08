import { getAudioMetadata } from "../audioUtils.js";

/**
 * Determines whether a sample file is stereo by reading its audio metadata.
 * Always returns the true channel count of the file.
 * Mono conversion decisions are deferred to SD sync time based on voice type.
 */
export function determineStereoConfiguration(filePath: string): boolean {
  const metadataResult = getAudioMetadata(filePath);
  if (metadataResult.success && metadataResult.data) {
    return (metadataResult.data.channels || 1) > 1;
  }
  return false;
}
