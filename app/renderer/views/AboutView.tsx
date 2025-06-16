import React from "react";

const openExternal = (url: string) => {
  // Use Electron shell if available, otherwise fallback to window.open
  if (window.electronAPI && window.electronAPI.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

interface AboutViewProps {
  navigate?: (to: string) => void;
}

const AboutView: React.FC<AboutViewProps> = ({ navigate }) => {
  // @ts-ignore
  const version =
    (import.meta.env ? import.meta.env.VITE_APP_VERSION : undefined) || "dev";
  const currentYear = new Date().getFullYear();
  const navigateBack = () => {
    if (navigate) {
      navigate("/kits");
    } else {
      window.history.length > 1
        ? window.history.back()
        : window.location.assign("/kits");
    }
  };
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-cyan-900 via-slate-900 to-gray-900 text-gray-100 px-4 py-8 overflow-hidden">
      <div className="relative z-10 w-full max-w-xl bg-white/10 dark:bg-slate-900/80 rounded-2xl shadow-2xl border border-cyan-800/30 backdrop-blur-md p-8 flex flex-col items-center">
        <button
          onClick={navigateBack}
          className="absolute left-4 top-4 px-3 py-1 bg-cyan-700/80 text-white rounded-full text-xs font-semibold shadow hover:bg-cyan-600/90 transition z-20"
        >
          ← Back
        </button>
        <h2 className="text-4xl font-extrabold mb-2 tracking-tight bg-gradient-to-r from-cyan-400 to-amber-300 bg-clip-text text-transparent drop-shadow-lg">
          Romper
        </h2>
        <p className="text-lg font-semibold mb-6 text-cyan-200 tracking-wide">
          Rample SD Card Manager
        </p>
        <div className="text-base leading-relaxed space-y-3 mb-6 text-center">
          <p>&copy; Pete Baker {currentYear}</p>
          <p className="mb-2">
            This application is{" "}
            <span className="font-semibold">
              not affiliated with Squarp SAS
            </span>
            .
          </p>
          <p className="mb-2">
            Licensed under the{" "}
            <a
              href="https://opensource.org/licenses/MIT"
              className="underline text-blue-200 hover:text-amber-300 transition"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT license
            </a>
            .
          </p>
          <button
            onClick={() => openExternal("https://github.com/peteb4ker/romper/")}
            className="inline-flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-cyan-600 to-amber-400 text-gray-900 font-bold rounded-full shadow-lg hover:scale-105 hover:from-cyan-400 hover:to-amber-200 transition-transform focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <svg
              width="20"
              height="20"
              fill="currentColor"
              className="inline-block"
            >
              <path d="M10 .3a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 10 5.8c.85.004 1.7.12 2.5.35 1.9-1.29 2.74-1.02 2.74-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 10 .3" />
            </svg>
            github.com/peteb4ker/romper
          </button>
        </div>
        <hr className="w-full border-gray-300 dark:border-gray-700 mb-4 opacity-30" />
        <div className="text-sm text-gray-200 text-center space-y-2">
          <p>
            Romper is an{" "}
            <span className="font-bold text-amber-200">open-source</span>{" "}
            Electron app for managing Squarp Rample SD cards.
          </p>
          <p>Feedback, bug reports, and contributions are welcome!</p>
          <p className="mt-2">
            Version: <span className="font-mono text-cyan-200">{version}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutView;
