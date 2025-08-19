/**
 * HMR (Hot Module Replacement) state management utilities
 * Preserves application state during development hot reloads
 */

const HMR_ROUTE_KEY = "hmr_route";
const HMR_SELECTED_KIT_KEY = "hmr_selected_kit";
const HMR_EXPLICIT_NAVIGATION_KEY = "hmr_explicit_navigation";

/**
 * Clear the explicit navigation marker
 */
export function clearExplicitNavigation(): void {
  sessionStorage.removeItem(HMR_EXPLICIT_NAVIGATION_KEY);
}

/**
 * Clear all HMR state from session storage
 */
export function clearHmrState(): void {
  sessionStorage.removeItem(HMR_ROUTE_KEY);
  sessionStorage.removeItem(HMR_SELECTED_KIT_KEY);
  sessionStorage.removeItem(HMR_EXPLICIT_NAVIGATION_KEY);
}

/**
 * Clear the saved selected kit from session storage
 */
export function clearSavedSelectedKit(): void {
  sessionStorage.removeItem(HMR_SELECTED_KIT_KEY);
}

/**
 * Get the saved selected kit name from session storage
 */
export function getSavedSelectedKit(): null | string {
  return sessionStorage.getItem(HMR_SELECTED_KIT_KEY);
}

/**
 * Check if HMR is available (exported for testing)
 */
export function isHmrAvailable(): boolean {
  return (
    typeof (import.meta as any).hot !== "undefined" &&
    (import.meta as any).hot !== null
  );
}

/**
 * Check if a kit exists in the kit list
 */
export function kitExists(
  kitName: string,
  kits: Array<{ name: string }>,
): boolean {
  return kits.some((k) => k.name === kitName);
}

/**
 * Mark that an explicit navigation action occurred (like back navigation)
 */
export function markExplicitNavigation(): void {
  sessionStorage.setItem(HMR_EXPLICIT_NAVIGATION_KEY, Date.now().toString());
}

/**
 * Restore the saved route if it exists and differs from current
 */
export function restoreRouteState(): void {
  const savedRoute = sessionStorage.getItem(HMR_ROUTE_KEY);
  if (savedRoute && savedRoute !== window.location.hash) {
    window.location.hash = savedRoute;
  }
}

/**
 * Restore selected kit if it exists in the kit list
 */
export function restoreSelectedKitIfExists(
  kits: Array<{ name: string }>,
  currentSelectedKit: null | string,
  setSelectedKit: ((kit: string) => void) | undefined,
): void {
  if (!isHmrAvailable() || !setSelectedKit) return;

  // Don't restore if user just performed explicit navigation (like back button)
  if (wasRecentExplicitNavigation()) {
    return;
  }

  const savedKit = getSavedSelectedKit();
  if (savedKit && kits.length > 0 && !currentSelectedKit) {
    if (kitExists(savedKit, kits)) {
      setSelectedKit(savedKit);
    }
  }
}

/**
 * Save the current route to session storage
 */
export function saveRouteState(): void {
  const currentPath = window.location.hash;
  sessionStorage.setItem(HMR_ROUTE_KEY, currentPath);
}

/**
 * Save the selected kit name to session storage
 */
export function saveSelectedKitState(kitName: string): void {
  sessionStorage.setItem(HMR_SELECTED_KIT_KEY, kitName);
}

/**
 * Setup HMR handlers for route preservation
 */
export function setupRouteHmrHandlers(): void {
  if (!(import.meta as any).hot) return;

  (import.meta as any).hot.dispose(() => {
    saveRouteState();
  });

  (import.meta as any).hot.accept(() => {
    restoreRouteState();
  });
}

/**
 * Check if an explicit navigation action occurred recently (within last 1000ms)
 */
export function wasRecentExplicitNavigation(): boolean {
  const timestamp = sessionStorage.getItem(HMR_EXPLICIT_NAVIGATION_KEY);
  if (!timestamp) return false;

  const navigationTime = parseInt(timestamp, 10);
  const now = Date.now();
  return now - navigationTime < 1000; // Within last 1 second
}
