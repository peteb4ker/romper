import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { applyTheme } from './utils/settingsManager';
import { SettingsProvider, useSettings } from './utils/SettingsContext';
import KitsView from './views/KitsView';
import AboutView from './views/AboutView';
import { FiSun, FiMoon } from 'react-icons/fi';
import { MdSdCard } from 'react-icons/md';
import './styles/index.css';

const StatusBar: React.FC = () => {
    const { sdCardPath, darkMode, setDarkMode } = useSettings();
    return (
        <div className="fixed bottom-0 left-0 w-full flex items-center justify-between px-4 py-2 bg-gray-200 dark:bg-slate-800 text-xs text-gray-700 dark:text-gray-200 border-t border-gray-300 dark:border-slate-700 z-20">
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><MdSdCard size={16} /> SD Card: <span className="font-mono">{sdCardPath || 'Not selected'}</span></span>
            </div>
            <div className="flex items-center gap-4">
                <a
                    href="https://squarp.net/rample/manual/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                >
                    Rample Manual
                </a>
                <a href="/about" className="underline hover:text-blue-600 dark:hover:text-blue-300 transition-colors">About</a>
                <button
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-300 dark:bg-slate-700 hover:bg-gray-400 dark:hover:bg-slate-600 transition"
                    onClick={() => setDarkMode(!darkMode)}
                    title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                    aria-label="Toggle dark mode"
                >
                    {darkMode ? <FiSun size={16} /> : <FiMoon size={16} />}
                </button>
            </div>
        </div>
    );
};

const App = () => {
    useEffect(() => {
        applyTheme(); // Apply the saved theme on app load
    }, []);

    const { sdCardPath } = useSettings();

    return (
        <Router>
            <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
                <div className="flex flex-1 min-h-0">
                    <main className="flex-1 min-h-0 flex flex-col h-full pb-12"> {/* Remove p-6 and any margin/padding */}
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
    );
};

const root = ReactDOM.createRoot(document.getElementById('app')!);
root.render(
    <SettingsProvider>
        <App />
    </SettingsProvider>
);