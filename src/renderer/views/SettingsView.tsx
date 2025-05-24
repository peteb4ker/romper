import React from 'react';
import ThemeToggle from '../components/ThemeToggle';

const SettingsView = () => {
    return (
        <div className="p-3 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 min-h-screen">
            <h2 className="text-lg font-bold mb-3">Settings</h2>
            <div className="space-y-2">
                <ThemeToggle />
            </div>
        </div>
    );
};

export default SettingsView;