// Settings manager - handles theme application and other settings utilities

/**
 * Applies the saved theme on app startup
 * Reads from localStorage and applies the appropriate theme
 */
export function applyTheme(): void {
  try {
    const savedSettings = localStorage.getItem("settings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      const isDark = settings.darkMode ?? false;

      // Apply theme to document
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Default to light theme if no saved settings
      document.documentElement.classList.remove("dark");
    }
  } catch (error) {
    console.error("Failed to apply saved theme:", error);
    // Default to light theme on error
    document.documentElement.classList.remove("dark");
  }
}
