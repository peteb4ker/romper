import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { SettingsProvider } from '../utils/SettingsContext';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
    beforeEach(() => {
        (window.electronAPI.readSettings as jest.Mock).mockResolvedValue({
            darkMode: false,
        });
    });

    it('should render the button with correct text based on darkMode', async () => {
        const { getByText } = render(
            <SettingsProvider>
                <ThemeToggle />
            </SettingsProvider>
        );

        await waitFor(() => expect(getByText('Enable Dark Mode')).toBeInTheDocument());
    });

    it('should toggle dark mode on button click', async () => {
        const { getByText } = render(
            <SettingsProvider>
                <ThemeToggle />
            </SettingsProvider>
        );

        const button = await waitFor(() => getByText('Enable Dark Mode'));
        fireEvent.click(button);

        await waitFor(() => expect(getByText('Disable Dark Mode')).toBeInTheDocument());
    });

    it('should toggle dark mode multiple times', async () => {
        const { getByText } = render(
            <SettingsProvider>
                <ThemeToggle />
            </SettingsProvider>
        );

        const button = await waitFor(() => getByText('Enable Dark Mode'));

        // First toggle
        fireEvent.click(button);
        await waitFor(() => expect(getByText('Disable Dark Mode')).toBeInTheDocument());

        // Second toggle
        fireEvent.click(button);
        await waitFor(() => expect(getByText('Enable Dark Mode')).toBeInTheDocument());
    });
});
