import "./styles/index.css";

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from "react-router-dom";

import AboutDialog from "./components/dialogs/AboutDialog";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useMessageDisplay } from "./components/hooks/shared/useMessageDisplay";
import MessageDisplay from "./components/MessageDisplay";
import { MessageDisplayContext } from "./components/MessageDisplayContext";
import StatusBar from "./components/StatusBar";
import { installDocumentDropGuard } from "./utils/documentDropGuard";
import { SettingsProvider } from "./utils/SettingsContext";
import AboutView from "./views/AboutView";
import KitsView from "./views/KitsView";

const AppContent = () => {
  const messageDisplay = useMessageDisplay();
  const [showAboutModal, setShowAboutModal] = useState(false);

  const handleCloseAbout = () => {
    setShowAboutModal(false);
  };

  // Listen for menu-about custom event (from LED icon click and native menu)
  useEffect(() => {
    const handler = () => setShowAboutModal(true);
    globalThis.addEventListener("menu-about", handler);
    return () => globalThis.removeEventListener("menu-about", handler);
  }, []);

  return (
    <MessageDisplayContext.Provider value={messageDisplay}>
      <div className="flex flex-col h-screen bg-surface-0 text-text-primary">
        <MessageDisplay />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-h-0 flex flex-col h-full pb-10">
            <ErrorBoundary area="Romper">
              <Routes>
                <Route element={<Navigate replace to="/kits" />} path="/" />
                <Route element={<KitsView />} path="/kits" />
                <Route element={<AboutView />} path="/about" />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <AboutDialog isOpen={showAboutModal} onClose={handleCloseAbout} />
      </div>
    </MessageDisplayContext.Provider>
  );
};

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

// Keep a file dropped outside a sample slot from navigating the window (RE-02).
installDocumentDropGuard();

const root = ReactDOM.createRoot(document.getElementById("app")!);
root.render(
  <SettingsProvider>
    <App />
  </SettingsProvider>,
);

import { setupRouteHmrHandlers } from "./utils/hmrStateManager";

// HMR route state preservation
setupRouteHmrHandlers();

export { App };
