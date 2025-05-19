import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { applyTheme } from './utils/settingsManager';
import { SettingsProvider } from './utils/SettingsContext';
import Sidebar from './components/Sidebar';
import KitsView from './views/KitsView';
import SamplesView from './views/SamplesView';
import SettingsView from './views/SettingsView';
import './styles/index.css';

const App = () => {
    useEffect(() => {
        applyTheme(); // Apply the saved theme on app load
    }, []);

    return (
        <SettingsProvider>
            <Router>
                <div className="flex h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
                    <Sidebar />
                    <main className="flex-1 p-6">
                        <Routes>
                            <Route path="/" element={<Navigate to="/kits" replace />} /> {/* Redirect root to /kits */}
                            <Route path="/kits" element={<KitsView />} />
                            <Route path="/samples" element={<SamplesView />} />
                            <Route path="/settings" element={<SettingsView />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </SettingsProvider>
    );
};

const root = ReactDOM.createRoot(document.getElementById('app')!);
root.render(<App />);