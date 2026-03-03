import "./styles/index.css";

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from "react-router-dom";
import { toast } from "sonner";

import AboutDialog from "./components/dialogs/AboutDialog";
import { useMessageDisplay } from "./components/hooks/shared/useMessageDisplay";
import MessageDisplay from "./components/MessageDisplay";
import { MessageDisplayContext } from "./components/MessageDisplayContext";
import StatusBar from "./components/StatusBar";
import { SettingsProvider } from "./utils/SettingsContext";
import { applyTheme } from "./utils/settingsManager";
import AboutView from "./views/AboutView";
import KitsView from "./views/KitsView";

declare global {
  interface Window {
    toast: typeof toast;
  }
}

const AppContent = () => {
  const messageDisplay = useMessageDisplay();
  const [showAboutModal, setShowAboutModal] = useState(false);

  const handleCloseAbout = () => {
    setShowAboutModal(false);
  };

  // Listen for menu-about custom event (from LED icon click and native menu)
  useEffect(() => {
    const handler = () => setShowAboutModal(true);
    window.addEventListener("menu-about", handler);
    return () => window.removeEventListener("menu-about", handler);
  }, []);

  return (
    <MessageDisplayContext.Provider value={messageDisplay}>
      <div className="flex flex-col h-screen bg-surface-0 text-text-primary">
        <MessageDisplay />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-h-0 flex flex-col h-full pb-10">
            <Routes>
              <Route element={<Navigate replace to="/kits" />} path="/" />
              <Route element={<KitsView />} path="/kits" />
              <Route element={<AboutView />} path="/about" />
            </Routes>
          </main>
        </div>
        <StatusBar />
        <AboutDialog isOpen={showAboutModal} onClose={handleCloseAbout} />
      </div>
    </MessageDisplayContext.Provider>
  );
};

const App = () => {
  useEffect(() => {
    applyTheme(); // Apply the saved theme on app load
  }, []);

  return (
    <Router>
      <AppContent />
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById("app")!);
root.render(
  <SettingsProvider>
    <App />
  </SettingsProvider>,
);

import { setupRouteHmrHandlers } from "./utils/hmrStateManager";

window.toast = toast;

// HMR route state preservation
setupRouteHmrHandlers();

export { App };
