import React from 'react';
import { useSettings } from '../utils/SettingsContext';

const ThemeToggle: React.FC = () => {
    const { darkMode, setDarkMode } = useSettings();

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
    };

    return (
        <button
            onClick={toggleDarkMode}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-md shadow hover:bg-gray-300 dark:hover:bg-gray-700 transition"
        >
            {darkMode ? 'Disable Dark Mode' : 'Enable Dark Mode'}
        </button>
    );
};

export default ThemeToggle;