import React from 'react';
import { useSettings } from '../utils/SettingsContext';
import { FiSun, FiMoon } from 'react-icons/fi';
import { MdSdCard } from 'react-icons/md';

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

export default StatusBar;
