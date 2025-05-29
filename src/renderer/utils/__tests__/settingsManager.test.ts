import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { getSetting, setSetting, applyTheme, toggleTheme } from '../settingsManager';

describe('settingsManager', () => {
    beforeEach(() => {
        const mockClassList = {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn(), // Explicitly mock toggle as a Jest mock function
            contains: vi.fn(), // Explicitly mock contains as a Jest mock function
        };

        Object.defineProperty(document, 'documentElement', {
            value: {
                classList: mockClassList,
            },
            configurable: true,
        });
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
            (window.electronAPI.getSetting as unknown as vi.Mock).mockResolvedValue(true);

            await applyTheme();

            expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true);
        });

        it('should not apply dark mode if darkMode is false', async () => {
            (window.electronAPI.getSetting as unknown as vi.Mock).mockResolvedValue(false);

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
