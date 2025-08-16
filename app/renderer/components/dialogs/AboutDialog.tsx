import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";

const openExternal = (url: string) => {
  if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
};

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  const version =
    (import.meta.env ? import.meta.env.VITE_APP_VERSION : undefined) ?? "dev";
  const currentYear = new Date().getFullYear();

  // Shared classes
  const headingStyles = "text-gray-900 dark:text-white";
  const borderStyles = "border-gray-200 dark:border-slate-700";
  const linkBtn =
    "underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors";

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Backdrop click to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Data-driven content to avoid repeated <p> blocks
  const infoLines: React.ReactNode[] = [
    <p key="c1">&copy; Pete Baker {currentYear}</p>,
    <p key="c2">
      This application is{" "}
      <span className="font-semibold">not affiliated with Squarp SAS</span>
    </p>,
    <p key="c3">
      Licensed under the{" "}
      <button
        className={linkBtn}
        onClick={() => openExternal("https://opensource.org/licenses/MIT")}
        type="button"
      >
        MIT license
      </button>
    </p>,
  ];

  return (
    <div
      aria-labelledby="about-title"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleBackdropClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-center justify-between p-6 border-b ${borderStyles}`}
        >
          <h2
            className={`text-xl font-semibold ${headingStyles}`}
            id="about-title"
          >
            About Romper
          </h2>
          <button
            aria-label="Close dialog"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            onClick={onClose}
            type="button"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h3 className={`text-2xl font-bold ${headingStyles}`}>Romper</h3>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Rample SD Card Manager
              </p>
            </div>

            {/* Info lines rendered from array to avoid duplication */}
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {infoLines}
            </div>

            {/* Single external action button */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() =>
                openExternal("https://github.com/peteb4ker/romper/")
              }
              type="button"
            >
              <svg
                aria-hidden="true"
                className="inline-block"
                fill="currentColor"
                height="16"
                width="16"
              >
                <path d="M8 .3a8 8 0 0 0-2.53 15.59c.4.07.54-.17.54-.38v-1.36c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.88-1.17-.88-1.17-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.22 1.87.86 2.33.66.07-.52.28-.86.5-1.06-1.78-.2-3.65-.89-3.65-3.96 0-.87.31-1.58.82-2.14-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82A7.65 7.65 0 0 1 8 4.64c.68.003 1.36.09 2 .28 1.52-1.03 2.19-.82 2.19-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.14 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.19c0 .21.14.46.55.38A8 8 0 0 0 8 .3" />
              </svg>
              GitHub Repository
            </button>

            <hr className={borderStyles} />

            {/* Footer text minimized and structured to reduce repeats */}
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
              {[
                <p key="f1">
                  Romper is an{" "}
                  <span className="font-semibold">open-source</span> Electron
                  app for managing Squarp Rample SD cards.
                </p>,
                <p key="f2">
                  Feedback, bug reports, and contributions are welcome.
                </p>,
                <p className="font-mono" key="f3">
                  Version: <span className="font-medium">{version}</span>
                </p>,
              ]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog;
