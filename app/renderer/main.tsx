import "./styles/index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import {
  HashRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { toast } from "sonner";

import { useMessageDisplay } from "./components/hooks/useMessageDisplay";
import MessageDisplay from "./components/MessageDisplay";
import { MessageDisplayContext } from "./components/MessageDisplayContext";
import StatusBar from "./components/StatusBar";
import { SettingsProvider } from "./utils/SettingsContext";
import AboutView from "./views/AboutView";
import KitsView from "./views/KitsView";

declare global {
  interface Window {
    toast: typeof toast;
  }
}

const App = () => {
  // Theme is now automatically applied by SettingsProvider
  const messageDisplay = useMessageDisplay();

  return (
    <MessageDisplayContext.Provider value={messageDisplay}>
      <Router>
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
          <MessageDisplay />
          <div className="flex flex-1 min-h-0">
            <main className="flex-1 min-h-0 flex flex-col h-full pb-10">
              <Routes>
                <Route path="/" element={<Navigate to="/kits" replace />} />
                <Route path="/kits" element={<KitsView />} />
                <Route path="/about" element={<AboutView />} />
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

window.toast = toast;

export { App };
