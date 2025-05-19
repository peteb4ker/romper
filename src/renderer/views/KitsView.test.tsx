import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { SettingsProvider, SettingsContext } from '../utils/SettingsContext';
import KitsView from './KitsView';

describe('KitsView', () => {
    const mockSettings = {
        sdCardPath: '/mock/path',
        setSdCardPath: jest.fn(),
        initializeSettings: jest.fn(),
        darkMode: false,
        setDarkMode: jest.fn(),
        settingsInitialized: true,
    };

    beforeEach(() => {
        jest.resetAllMocks();
        (window.electronAPI.scanSdCard as jest.Mock).mockResolvedValue([]);
    });

    const renderWithSettings = (ui: React.ReactElement) => {
        return render(
            <SettingsContext.Provider value={mockSettings}>
                {ui}
            </SettingsContext.Provider>
        );
    };

    it('should render without crashing', async () => {
        await act(async () => {
            const { container } = renderWithSettings(<KitsView />);
            expect(container).toBeInTheDocument();
        });
    });

    it('should render a message when no kits are available', async () => {
        (window.electronAPI.scanSdCard as jest.Mock).mockResolvedValue([]);

        const { getByText } = renderWithSettings(<KitsView />);

        await waitFor(() => {
            expect(getByText('No kits available.')).toBeInTheDocument();
        });
    });

    it('should render kits when available', async () => {
        (window.electronAPI.scanSdCard as jest.Mock).mockResolvedValue(['Kit1', 'Kit2']);

        const { getByText } = renderWithSettings(<KitsView />);

        await waitFor(() => {
            expect(getByText('Kit1')).toBeInTheDocument();
            expect(getByText('Kit2')).toBeInTheDocument();
        });
    });
});
