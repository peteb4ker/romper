import { useSyncExternalStore } from "react";

/** The theme on screen: dark while the root element has the `dark` class */
export type AppliedTheme = "dark" | "light";

const listeners = new Set<() => void>();

/**
 * Put a theme on screen. The `dark` class on the root element switches the
 * CSS color tokens; canvases copy those colors into pixels, so they hear of
 * the change through `useAppliedTheme` and redraw (#760). SettingsProvider
 * calls this for the theme setting and, when the theme follows the system,
 * for a `prefers-color-scheme` change.
 */
export function applyTheme(isDark: boolean): void {
  const before = getAppliedTheme();
  document.documentElement.classList.toggle("dark", isDark);
  if (getAppliedTheme() === before) return;
  for (const listener of [...listeners]) listener();
}

/** The theme on screen now */
export function getAppliedTheme(): AppliedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** The theme on screen; the component re-renders when it changes */
export function useAppliedTheme(): AppliedTheme {
  return useSyncExternalStore(subscribe, getAppliedTheme);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
