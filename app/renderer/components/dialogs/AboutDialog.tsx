import { X } from "@phosphor-icons/react";
import React, { useEffect } from "react";

import LedPixelGrid from "./led-grid/LedPixelGrid";

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

  return (
    <div
      aria-labelledby="about-title"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleBackdropClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      }}
      role="dialog"
      tabIndex={-1}
    >
      <div className="relative rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.6)] border border-white/10 w-full max-w-lg overflow-hidden bg-black">
        {/* LED Grid Background */}
        <LedPixelGrid />

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black/40 pointer-events-none" />

        {/* Close button */}
        <button
          aria-label="Close dialog"
          className="absolute top-3 right-3 z-10 text-white/60 hover:text-white transition-colors"
          onClick={onClose}
          type="button"
        >
          <X size={20} />
        </button>

        {/* Content overlay */}
        <div className="relative z-10 px-8 py-10 text-center pointer-events-none">
          {/* Title */}
          <h2 id="about-title">
            <span className="sr-only">About Romper</span>
            <span
              aria-hidden="true"
              className="block text-3xl font-bold text-white tracking-[0.35em] uppercase"
            >
              R O M P E R
            </span>
          </h2>

          {/* Subtitle */}
          <p className="mt-2 text-sm text-white/70">Rample SD Card Manager</p>

          {/* Silkscreen label */}
          <p className="mt-4 text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">
            Rample Waves System
          </p>

          {/* Info section */}
          <div className="mt-8 space-y-2 text-xs text-white/60">
            <p>&copy; Pete Baker {currentYear}</p>
            <p>
              This application is{" "}
              <span className="font-semibold text-white/70">
                not affiliated with Squarp SAS
              </span>
            </p>
            <p>
              Licensed under the{" "}
              <button
                className="underline text-white/80 hover:text-white transition-colors pointer-events-auto"
                onClick={() =>
                  openExternal("https://opensource.org/licenses/MIT")
                }
                type="button"
              >
                MIT license
              </button>
            </p>
          </div>

          {/* GitHub button */}
          <div className="mt-6">
            <button
              className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-md border border-white/20 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
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
          </div>

          {/* Footer */}
          <div className="mt-8 text-[10px] text-white/30 space-y-1">
            <p>
              Romper is an <span className="font-semibold">open-source</span>{" "}
              Electron app for managing Squarp Rample SD cards.
            </p>
            <p>Feedback, bug reports, and contributions are welcome.</p>
            <p className="font-mono">
              Version: <span className="font-medium">{version}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog;
