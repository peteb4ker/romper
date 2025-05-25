import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { applyTheme } from './utils/settingsManager';
import { SettingsProvider, useSettings } from './utils/SettingsContext';
import Sidebar from './components/Sidebar';
import KitsView from './views/KitsView';
import SettingsView from './views/SettingsView';
import AboutView from './views/AboutView';
import RampleBinView from './views/RampleBinView';
import { FiSun, FiMoon } from 'react-icons/fi';
import { MdSdCard } from 'react-icons/md';
import './styles/index.css';

const StatusBar: React.FC = () => {
    const { sdCardPath, darkMode, setDarkMode } = useSettings();
    return (
        <div className="fixed bottom-0 left-56 right-0 h-10 bg-gray-200 dark:bg-slate-800 border-t border-gray-300 dark:border-slate-700 flex items-center px-4 text-xs text-gray-700 dark:text-gray-300 z-50">
            {sdCardPath ? (
                <div className="flex items-center gap-2 w-full">
                    <MdSdCard className="text-gray-500 dark:text-gray-300" size={16} />
                    <span className="truncate max-w-[70vw]" title={sdCardPath}>{sdCardPath}</span>
                </div>
            ) : (
                <span className="italic text-gray-400 flex items-center gap-2"><MdSdCard className="text-gray-500 dark:text-gray-300" size={16} />No SD card selected</span>
            )}
            <button
                className="ml-4 p-1 rounded hover:bg-gray-300 dark:hover:bg-slate-700 flex items-center justify-center"
                onClick={() => setDarkMode(!darkMode)}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle dark mode"
            >
                {darkMode ? <FiSun size={16} /> : <FiMoon size={16} />}
            </button>
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
                    <Sidebar />
                    <main className="flex-1 min-h-0 flex flex-col h-full p-6 pb-12"> {/* Add bottom padding for status bar */}
                        <Routes>
                            <Route path="/" element={<Navigate to="/kits" replace />} />
                            <Route path="/kits" element={<KitsView />} />
                            <Route path="/rample-bin" element={<RampleBinView sdCardPath={sdCardPath} />} />
                            <Route path="/settings" element={<SettingsView />} />
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