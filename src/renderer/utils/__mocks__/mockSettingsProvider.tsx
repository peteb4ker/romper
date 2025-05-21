import React, { createContext, useContext, useState } from 'react';

const MockSettingsContext = createContext({
    darkMode: false,
    setDarkMode: (newMode: boolean) => { },
});

export const MockSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [darkMode, setDarkMode] = useState(false);

    const mockSettings = {
        darkMode,
        setDarkMode: jest.fn((newMode: boolean) => setDarkMode(newMode)),
    };

    return (
        <MockSettingsContext.Provider value={mockSettings}>
            {children}
        </MockSettingsContext.Provider>
    );
};

export const useMockSettings = () => useContext(MockSettingsContext);
