import React from 'react';
import { render, act } from '@testing-library/react';
import { SettingsProvider } from '../utils/SettingsContext';
import SettingsView from './SettingsView';

describe('SettingsView', () => {
    it('should render without crashing', async () => {
        await act(async () => {
            const { container } = render(
                <SettingsProvider>
                    <SettingsView />
                </SettingsProvider>
            );
            expect(container).toBeInTheDocument();
        });
    });
});
