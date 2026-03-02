import React from "react";
import { FiMonitor, FiMoon, FiSun } from "react-icons/fi";

import { type ThemeMode } from "../../utils/SettingsContext";

interface AppearanceTabProps {
  onThemeModeChange: (themeMode: ThemeMode) => void;
  themeMode: ThemeMode;
}

const AppearanceTab: React.FC<AppearanceTabProps> = ({
  onThemeModeChange,
  themeMode,
}) => {
  const themeOptions: Array<{
    icon: React.ReactNode;
    label: string;
    value: ThemeMode;
  }> = [
    { icon: <FiSun className="w-4 h-4" />, label: "Light", value: "light" },
    {
      icon: <FiMonitor className="w-4 h-4" />,
      label: "System",
      value: "system",
    },
    { icon: <FiMoon className="w-4 h-4" />, label: "Dark", value: "dark" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-text-primary mb-4">
              Appearance
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {themeOptions.map((option) => {
                const isSelected = themeMode === option.value;

                return (
                  <div
                    className="flex flex-col items-center gap-2"
                    key={option.value}
                  >
                    <button
                      className={`relative w-16 h-16 rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                        isSelected
                          ? "border-accent-primary ring-2 ring-accent-primary/30"
                          : "border-border-subtle hover:border-border-default"
                      }`}
                      onClick={() => onThemeModeChange(option.value)}
                    >
                      {option.value === "light" && (
                        <div className="w-full h-full bg-surface-1 flex items-center justify-center">
                          <FiSun className="w-6 h-6 text-accent-warning" />
                        </div>
                      )}

                      {option.value === "dark" && (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <FiMoon className="w-6 h-6 text-accent-primary" />
                        </div>
                      )}

                      {option.value === "system" && (
                        <>
                          {/* Split background - light left, dark right */}
                          <div className="absolute inset-0 flex">
                            <div className="w-1/2 bg-surface-1"></div>
                            <div className="w-1/2 bg-gray-900"></div>
                          </div>
                          {/* Split monitor icon using two overlapping icons with clipping */}
                          <div className="relative w-full h-full flex items-center justify-center">
                            <div className="relative w-6 h-6">
                              {/* Left half - dark icon on light background */}
                              <div className="absolute inset-0 w-1/2 overflow-hidden">
                                <FiMonitor className="w-6 h-6 text-text-primary" />
                              </div>
                              {/* Right half - light icon on dark background */}
                              <div className="absolute inset-0 w-1/2 left-1/2 overflow-hidden">
                                <FiMonitor className="w-6 h-6 text-white -ml-3" />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </button>

                    <span
                      className={`text-sm font-medium ${
                        isSelected
                          ? "text-accent-primary"
                          : "text-text-secondary"
                      }`}
                    >
                      {option.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-text-tertiary mt-2">
              Choose how Romper looks. System matches your operating system's
              appearance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceTab;
