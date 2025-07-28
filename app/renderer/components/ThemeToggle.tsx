import React from "react";

import { useSettings } from "../utils/SettingsContext";

const ThemeToggle: React.FC = () => {
  const { isDarkMode, themeMode, setThemeMode } = useSettings();

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
      case "light":
        return "Light Mode";
      case "dark":
        return "Dark Mode";
      case "system":
        return `System (${isDarkMode ? "Dark" : "Light"})`;
      default:
        return "Theme";
    }
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-md shadow hover:bg-gray-300 dark:hover:bg-gray-700 transition"
    >
      {getButtonText()}
    </button>
  );
};

export default ThemeToggle;
