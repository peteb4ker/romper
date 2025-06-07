import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, getSetting, setSetting, toggleTheme } from '../settingsManager';

describe('settingsManager', () => {
    beforeEach(() => {
        const mockClassList = {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn(),
            contains: vi.fn(),
        };

        Object.defineProperty(document, 'documentElement', {
            value: {
                classList: mockClassList,
            },
            configurable: true,
        });

        // Properly mock electronAPI methods as spies
        window.electronAPI = {
            getSetting: vi.fn(),
            setSetting: vi.fn(),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getSetting', () => {
        it('should call electronAPI.getSetting with the correct key', async () => {
            await getSetting('darkMode');
            expect(window.electronAPI.getSetting).toHaveBeenCalledWith('darkMode');
        });
    });

    describe('setSetting', () => {
        it('should call electronAPI.setSetting with the correct key and value', async () => {
            await setSetting('darkMode', true);
            expect(window.electronAPI.setSetting).toHaveBeenCalledWith('darkMode', true);
        });
    });

    describe('applyTheme', () => {
        it('should apply dark mode if darkMode is true', async () => {
            (window.electronAPI.getSetting as any).mockResolvedValue(true);

            await applyTheme();

            expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
        });

        it('should not apply dark mode if darkMode is false', async () => {
            (window.electronAPI.getSetting as any).mockResolvedValue(false);

            await applyTheme();

            expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
        });
    });

    describe('toggleTheme', () => {
        it('should toggle the theme and update the setting', () => {
            (document.documentElement.classList.contains as unknown as vi.Mock).mockReturnValue(false);

            toggleTheme();

            expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
            expect(window.electronAPI.setSetting).toHaveBeenCalledWith('darkMode', true);
        });

        it('should toggle the theme off and update the setting', () => {
            (document.documentElement.classList.contains as unknown as vi.Mock).mockReturnValue(true);

            toggleTheme();

            expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', false);
            expect(window.electronAPI.setSetting).toHaveBeenCalledWith('darkMode', false);
        });
    });
});
