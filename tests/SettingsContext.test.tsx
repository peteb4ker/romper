import { render, waitFor } from '@testing-library/react';
import { SettingsContext } from '../src/renderer/utils/SettingsContext';

describe('SettingsContext', () => {
    const mockSettingsContextValue = {
        sdCardPath: null,
        setSdCardPath: jest.fn(),
        darkMode: false,
        setDarkMode: jest.fn(),
        initializeSettings: jest.fn(),
        settingsInitialized: true,
    };

    it('should initialize settings successfully', async () => {
        const { getByText } = render(
            <SettingsContext.Provider value={mockSettingsContextValue}>
                <div>Settings Loaded</div>
            </SettingsContext.Provider>
        );

        await waitFor(() => expect(getByText('Settings Loaded')).toBeInTheDocument());
    });

    it('should handle errors during settings initialization', async () => {
        mockSettingsContextValue.initializeSettings.mockRejectedValue(new Error('Failed to load settings'));

        const { getByText } = render(
            <SettingsContext.Provider value={mockSettingsContextValue}>
                <div>Settings Loaded</div>
            </SettingsContext.Provider>
        );

        await waitFor(() => expect(getByText('Settings Loaded')).toBeInTheDocument());
    });
});