import React from "react";

import { useSettings } from "../utils/SettingsContext";

const ThemeToggle: React.FC = () => {
  const { isDarkMode, setThemeMode, themeMode } = useSettings();

  const toggleDarkMode = () => {
    // Cycle through: light -> dark -> system
    if (themeMode === "light") {
      setThemeMode("dark");
    } else if (themeMode === "dark") {
      setThemeMode("system");
    } else {
      setThemeMode("light");
    }
  };

  const getButtonText = () => {
    switch (themeMode) {
      case "dark":
        return "Dark Mode";
      case "light":
        return "Light Mode";
      case "system":
        return `System (${isDarkMode ? "Dark" : "Light"})`;
      default:
        return "Theme";
    }
  };

  return (
    <button
      className="px-4 py-2 bg-surface-3 text-text-primary rounded-md shadow hover:bg-surface-4 transition duration-150"
      onClick={toggleDarkMode}
    >
      {getButtonText()}
    </button>
  );
};

export default ThemeToggle;
