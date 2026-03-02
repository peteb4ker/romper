import React from "react";

const openExternal = (url: string) => {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

interface AboutViewProps {
  navigate?: (to: string) => void;
}

// Add type declaration for import.meta.env
declare global {
  interface ImportMeta {
    env: {
      VITE_APP_VERSION?: string;
    };
  }
}

const AboutView: React.FC<AboutViewProps> = ({ navigate }) => {
  // @ts-ignore
  const version =
    (import.meta.env ? import.meta.env.VITE_APP_VERSION : undefined) ?? "dev";
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
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-surface-0 text-text-primary px-4 py-8 overflow-hidden">
      <div className="relative z-10 w-full max-w-xl bg-surface-2 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-border-subtle p-8 flex flex-col items-center">
        <button
          className="absolute left-4 top-4 px-3 py-1 bg-accent-primary text-white rounded-full text-xs font-semibold shadow hover:bg-accent-primary/80 transition z-20"
          onClick={navigateBack}
        >
          ← Back
        </button>
        <h2 className="text-4xl font-extrabold mb-2 tracking-tight text-accent-primary drop-shadow-lg">
          Romper
        </h2>
        <p className="text-lg font-semibold mb-6 text-text-secondary tracking-wide">
          Rample SD Card Manager
        </p>
        <div className="text-base leading-relaxed space-y-3 mb-6 text-center text-text-secondary">
          <p>&copy; Pete Baker {currentYear}</p>
          <p className="mb-2">
            This application is{" "}
            <span className="font-semibold text-text-primary">
              not affiliated with Squarp SAS
            </span>
          </p>
          <p className="mb-2">
            Licensed under the{" "}
            <a
              className="underline text-accent-primary hover:text-accent-primary/80 transition"
              href="https://opensource.org/licenses/MIT"
              rel="noopener noreferrer"
              target="_blank"
            >
              MIT license
            </a>
          </p>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 mt-2 bg-accent-primary text-white font-bold rounded-full shadow-lg hover:bg-accent-primary/80 transition focus:outline-none focus:ring-2 focus:ring-accent-primary"
            onClick={() => openExternal("https://github.com/peteb4ker/romper/")}
          >
            <svg
              className="inline-block"
              fill="currentColor"
              height="20"
              width="20"
            >
              <path d="M10 .3a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 10 5.8c.85.004 1.7.12 2.5.35 1.9-1.29 2.74-1.02 2.74-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 10 .3" />
            </svg>
            github.com/peteb4ker/romper
          </button>
        </div>
        <hr className="w-full border-border-subtle mb-4 opacity-30" />
        <div className="text-sm text-text-secondary text-center space-y-2">
          <p>
            Romper is an{" "}
            <span className="font-bold text-accent-warning">open-source</span>{" "}
            Electron app for managing Squarp Rample SD cards.
          </p>
          <p>Feedback, bug reports, and contributions are welcome!</p>
          <p className="mt-2">
            Version:{" "}
            <span className="font-mono text-accent-primary">{version}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutView;
