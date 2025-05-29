import React from 'react';
import { render, screen } from '@testing-library/react';
import KitDetails from '../src/renderer/components/KitDetails';

describe('KitDetails voice name controls', () => {
  it('shows edit/rescan controls and a no-name indicator if no voice name is set', async () => {
    render(
      <KitDetails
        kitName="TestKit"
        sdCardPath="/sd"
        onBack={() => {}}
      />
    );
    // Wait for async effects
    // Instead of findByText (which fails if there are multiple), use findAllByText and check count
    const noNameIndicators = await screen.findAllByText('No voice name set');
    expect(noNameIndicators.length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Edit voice name').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Rescan voice name').length).toBeGreaterThan(0);
  });
  it('auto-scans all voice names if none are set', async () => {
    // Mock electronAPI for this test
    (window as any).electronAPI = {
      readRampleLabels: async () => ({
        kits: {
          TestKit: { label: 'TestKit', voiceNames: {} }
        }
      }),
      writeRampleLabels: async () => {},
      listFilesInRoot: async () => [
        '1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav'
      ]
    };
    render(
      <KitDetails
        kitName="TestKit"
        sdCardPath="/sd"
        onBack={() => {}}
      />
    );
    // Wait for async effects and auto-scan
    expect(await screen.findByText('Kick')).toBeInTheDocument();
    expect(await screen.findByText('Snare')).toBeInTheDocument();
    expect(await screen.findByText('Hat')).toBeInTheDocument();
    expect(await screen.findByText('Tom')).toBeInTheDocument();
  });
});

// Mock canvas getContext for jsdom
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function () { return null; } as any;
});
