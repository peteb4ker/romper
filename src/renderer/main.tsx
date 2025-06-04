import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { applyTheme } from './utils/settingsManager';
import { SettingsProvider } from './utils/SettingsContext';
import KitsView from './views/KitsView';
import AboutView from './views/AboutView';
import StatusBar from './components/StatusBar';
import MessageDisplay from './components/MessageDisplay';
import { useMessageDisplay } from './components/hooks/useMessageDisplay';
import './styles/index.css';

export const MessageDisplayContext = React.createContext<ReturnType<typeof useMessageDisplay> | null>(null);

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
                        <main className="flex-1 min-h-0 flex flex-col h-full pb-12">
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

const root = ReactDOM.createRoot(document.getElementById('app')!);
root.render(
    <SettingsProvider>
        <App />
    </SettingsProvider>
);

export { App };