import React, { useEffect, useState } from "react";
import {
  FiFolder,
  FiMonitor,
  FiMoon,
  FiSettings,
  FiSun,
  FiX,
} from "react-icons/fi";

import { type ThemeMode, useSettings } from "../../utils/SettingsContext";

interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesDialog: React.FC<PreferencesDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    themeMode,
    defaultToMonoSamples,
    confirmDestructiveActions,
    localStorePath,
    localStoreStatus,
    setThemeMode,
    setDefaultToMonoSamples,
    setConfirmDestructiveActions,
    setLocalStorePath,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<
    "samples" | "appearance" | "advanced"
  >("samples");

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleChangeLocalStore = async () => {
    try {
      const result = await window.electronAPI.selectExistingLocalStore?.();
      if (result?.success && result.path) {
        await setLocalStorePath(result.path);
      }
    } catch (error) {
      console.error("Failed to change local store:", error);
    }
  };

  const themeOptions: Array<{
    value: ThemeMode;
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: "light", label: "Light", icon: <FiSun className="w-4 h-4" /> },
    {
      value: "system",
      label: "System",
      icon: <FiMonitor className="w-4 h-4" />,
    },
    { value: "dark", label: "Dark", icon: <FiMoon className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FiSettings className="text-lg" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Preferences
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
            aria-label="Close preferences"
          >
            <FiX />
          </button>
        </div>

        <div className="flex h-96">
          {/* Tabs Sidebar */}
          <div className="w-48 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-gray-700">
            <nav className="p-2">
              <button
                onClick={() => setActiveTab("samples")}
                className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                  activeTab === "samples"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                Sample Management
              </button>
              <button
                onClick={() => setActiveTab("appearance")}
                className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                  activeTab === "appearance"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                Appearance
              </button>
              <button
                onClick={() => setActiveTab("advanced")}
                className={`w-full text-left px-3 py-2 rounded transition-colors ${
                  activeTab === "advanced"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                }`}
              >
                Advanced
              </button>
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Sample Management Tab */}
            {activeTab === "samples" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Sample Assignment
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Default to mono samples
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Automatically assign stereo samples as mono to a
                          single voice.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          When enabled, stereo samples will take 1 mono slot and
                          will be converted to mono by averaging the left and
                          right channel.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          When disabled, stereo samples will be assigned to
                          adjacent voices, taking the same sample slot on both
                          voices.
                        </p>
                      </div>
                      <label className="flex items-center ml-4">
                        <input
                          type="checkbox"
                          checked={defaultToMonoSamples}
                          onChange={(e) =>
                            setDefaultToMonoSamples(e.target.checked)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700"
                        />
                      </label>
                    </div>

                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Confirm destructive actions
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Show confirmation prompts before replacing or deleting
                          samples
                        </p>
                      </div>
                      <label className="flex items-center ml-4">
                        <input
                          type="checkbox"
                          checked={confirmDestructiveActions}
                          onChange={(e) =>
                            setConfirmDestructiveActions(e.target.checked)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                        Appearance
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        {themeOptions.map((option) => {
                          const isSelected = themeMode === option.value;

                          return (
                            <div
                              key={option.value}
                              className="flex flex-col items-center gap-2"
                            >
                              <button
                                onClick={() => setThemeMode(option.value)}
                                className={`relative w-16 h-16 rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                                  isSelected
                                    ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                                }`}
                              >
                                {option.value === "light" && (
                                  <div className="w-full h-full bg-white flex items-center justify-center">
                                    <FiSun className="w-6 h-6 text-yellow-500" />
                                  </div>
                                )}

                                {option.value === "dark" && (
                                  <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                    <FiMoon className="w-6 h-6 text-blue-400" />
                                  </div>
                                )}

                                {option.value === "system" && (
                                  <>
                                    {/* Split background - light left, dark right */}
                                    <div className="absolute inset-0 flex">
                                      <div className="w-1/2 bg-white"></div>
                                      <div className="w-1/2 bg-gray-900"></div>
                                    </div>
                                    {/* Split monitor icon using two overlapping icons with clipping */}
                                    <div className="relative w-full h-full flex items-center justify-center">
                                      <div className="relative w-6 h-6">
                                        {/* Left half - dark icon on light background */}
                                        <div className="absolute inset-0 w-1/2 overflow-hidden">
                                          <FiMonitor className="w-6 h-6 text-gray-800" />
                                        </div>
                                        {/* Right half - light icon on dark background */}
                                        <div className="absolute inset-0 w-1/2 left-1/2 overflow-hidden">
                                          <FiMonitor className="w-6 h-6 text-gray-100 -ml-3" />
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </button>

                              <span
                                className={`text-sm font-medium ${
                                  isSelected
                                    ? "text-blue-700 dark:text-blue-300"
                                    : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {option.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Choose how Romper looks. System matches your operating
                        system's appearance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === "advanced" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Local Store
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Local Store Path
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 p-2 bg-gray-50 dark:bg-slate-700 rounded border border-gray-300 dark:border-gray-600 font-mono text-sm text-gray-700 dark:text-gray-300">
                          {localStorePath || "No local store configured"}
                        </div>
                        <button
                          onClick={handleChangeLocalStore}
                          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <FiFolder className="text-sm" />
                          Change...
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Location of your sample database and kit storage
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Status
                      </label>
                      <div className="p-2 bg-gray-50 dark:bg-slate-700 rounded border border-gray-300 dark:border-gray-600 text-sm">
                        {localStoreStatus?.isValid ? (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ Valid local store
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">
                            ✗ {localStoreStatus?.error || "Invalid local store"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreferencesDialog;
