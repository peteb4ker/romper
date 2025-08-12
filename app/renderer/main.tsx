import "./styles/index.css";

import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from "react-router-dom";
import { toast } from "sonner";

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

const App = () => {
  useEffect(() => {
    applyTheme(); // Apply the saved theme on app load
  }, []);

  const messageDisplay = useMessageDisplay();

  return (
    <MessageDisplayContext.Provider value={messageDisplay}>
      <Router>
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
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
        </div>
      </Router>
    </MessageDisplayContext.Provider>
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
