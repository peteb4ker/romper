/**
 * Shared test utilities for Rample naming service tests
 * Provides consistent mock implementations to avoid logic duplication
 */

/**
 * Generate a mock Rample-compliant path for testing
 * This centralizes the mock naming logic to avoid duplication across tests
 */
export function generateMockRamplePath(
  sample: unknown,
  sdCardRoot: string,
): string {
  return `${sdCardRoot}/${sample.kit_name}/${sample.voice_number}sample${sample.slot_number + 1}.wav`;
}

/**
 * Generate mock Rample-compliant path and filename for testing
 * This centralizes the mock naming logic to avoid duplication across tests
 */
export function generateMockRamplePathAndFilename(
  sample: unknown,
  sdCardRoot: string,
): { destinationPath: string; filename: string } {
  const filename = `${sample.voice_number}sample${sample.slot_number + 1}.wav`;
  const destinationPath = `${sdCardRoot}/${sample.kit_name}/${filename}`;
  return { destinationPath, filename };
}
