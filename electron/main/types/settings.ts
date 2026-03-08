/**
 * Type definitions for in-memory settings management
 */

export interface InMemorySettings extends Record<string, unknown> {
  /** Path to the local store directory. Can be null if not configured. */
  localStorePath: null | string;

  /** SD card path - typically set via environment variable overrides */
  sdCardPath?: string;
}
