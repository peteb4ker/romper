import { vi } from "vitest";

import type { SettingsContextProps } from "../../app/renderer/utils/SettingsContext";

/**
 * A complete `useSettings()` value for tests that mock the hook. Pass the
 * fields a test cares about as overrides.
 */
export const createMockSettings = (
  overrides: Partial<SettingsContextProps> = {},
): SettingsContextProps => ({
  clearError: vi.fn(),
  confirmDestructiveActions: true,
  error: null,
  isDarkMode: false,
  isInitialized: true,
  isLoading: false,
  localStorePath: "/mock/local/store",
  localStoreStatus: null,
  refreshLocalStoreStatus: vi.fn().mockResolvedValue(undefined),
  setConfirmDestructiveActions: vi.fn().mockResolvedValue(undefined),
  setLocalStorePath: vi.fn().mockResolvedValue(true),
  setThemeMode: vi.fn().mockResolvedValue(undefined),
  themeMode: "light",
  ...overrides,
});
