// Test suite for KitsView component
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TestSettingsProvider } from './TestSettingsProvider';
import KitsView from '../KitsView';

describe('KitsView', () => {
  beforeEach(() => {
    // Mock all electronAPI methods outside of the test body for isolation
    window.electronAPI = {
      scanSdCard: vi.fn().mockResolvedValue(['A0', 'A1']),
      listFilesInRoot: vi.fn().mockResolvedValue(['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav']),
      readRampleLabels: vi.fn().mockResolvedValue({
        kits: {
          A0: {
            label: 'A0',
            // Directly mock the result of inference logic:
            voiceNames: { 1: 'Kick', 2: 'Snare', 3: 'Hat', 4: 'Tom' }
          },
          A1: { label: 'A1', voiceNames: {} }
        }
      }),
      getAudioBuffer: vi.fn().mockResolvedValue({ slice: () => new ArrayBuffer(8) }),
      writeRampleLabels: vi.fn().mockResolvedValue(undefined),
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up DOM and reset modules
    cleanup();
  });
  it('renders KitBrowser with kits', async () => {
    render(<TestSettingsProvider><KitsView /></TestSettingsProvider>);
    // There may be multiple elements with the same kit label, so use findAllByText
    const kitA0s = await screen.findAllByText('A0');
    const kitA1s = await screen.findAllByText('A1');
    expect(kitA0s.length).toBeGreaterThan(0);
    expect(kitA1s.length).toBeGreaterThan(0);
  });
});
