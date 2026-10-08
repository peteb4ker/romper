/**
 * Type definitions for in-memory settings management
 */

/**
 * The settings held in main. Keys Romper doesn't know (from a newer version,
 * say) are kept as loaded, so writing a setting never drops them (RE-21).
 */
export interface InMemorySettings
  extends KnownSettings, Record<string, unknown> {}

/** The settings Romper knows about, as saved in `romper-settings.json`. */
export interface KnownSettings {
  /** Ask before deleting a sample. The renderer defaults it to on. */
  confirmDestructiveActions?: boolean;

  /** Path to the local store directory. Can be null if not configured. */
  localStorePath: null | string;

  /** The SD card folder chosen in the sync dialog. */
  sdCardPath?: null | string;

  /** Light, dark or follow the system. The renderer defaults it to system. */
  themeMode?: ThemeMode;
}

export type ThemeMode = "dark" | "light" | "system";
