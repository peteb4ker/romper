import React from "react";
import { FiDatabase, FiMonitor, FiMoon, FiSun } from "react-icons/fi";

import { useSettings } from "../utils/SettingsContext";

interface StatusBarProps {
  onAboutClick?: () => void;
  progress?: null | number; // 0-100, or null for none
}

const StatusBar: React.FC<StatusBarProps> = ({
  onAboutClick,
  progress = null,
}) => {
  const { isDarkMode, localStorePath, setThemeMode, themeMode } = useSettings();

  // Extract nested ternary operations into independent statements
  const getThemeDisplayText = () => {
    if (themeMode === "system") {
      const currentMode = isDarkMode ? "dark" : "light";
      return ` (${currentMode})`;
    }
    return "";
  };

  const getThemeIcon = () => {
    if (themeMode === "system") {
      return <FiMonitor size={16} />;
    }
    if (isDarkMode) {
      return <FiSun size={16} />;
    }
    return <FiMoon size={16} />;
  };
  return (
    <div className="fixed bottom-0 left-0 w-full flex items-center justify-between px-4 py-2 bg-gray-200 dark:bg-slate-800 text-xs text-gray-700 dark:text-gray-200 border-t border-gray-300 dark:border-slate-700 z-20">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <FiDatabase size={16} /> Local Store:{" "}
          <span className="font-mono">
            {localStorePath || "Not configured"}
          </span>
        </span>
        {progress !== null && (
          <div
            className="ml-4 w-32 h-2 bg-gray-300 dark:bg-slate-700 rounded overflow-hidden"
            data-testid="progress-bar"
          >
            <div
              className="h-2 bg-blue-500 dark:bg-blue-400 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <a
          className="underline hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
          href="https://squarp.net/rample/manual/"
          rel="noopener noreferrer"
          target="_blank"
        >
          Rample Manual
        </a>
        <button
          className="underline hover:text-blue-600 dark:hover:text-blue-300 transition-colors bg-transparent border-none p-0 cursor-pointer"
          onClick={onAboutClick}
          type="button"
        >
          About
        </button>
        <button
          aria-label="Toggle theme mode"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-300 dark:bg-slate-700 hover:bg-gray-400 dark:hover:bg-slate-600 transition"
          onClick={() => {
            // Cycle through: light -> dark -> system
            if (themeMode === "light") {
              setThemeMode("dark");
            } else if (themeMode === "dark") {
              setThemeMode("system");
            } else {
              setThemeMode("light");
            }
          }}
          title={`Current: ${themeMode}${getThemeDisplayText()}`}
        >
          {getThemeIcon()}
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
