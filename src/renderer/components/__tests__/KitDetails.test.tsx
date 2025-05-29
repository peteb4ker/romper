import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import KitDetails from '../KitDetails';

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

// Helper to mock electronAPI (no-op for listFilesInRoot, since we use in-memory samples now)
function mockElectronAPI(files: string[], initialVoiceNames: any = {}) {
  (window as any).electronAPI = {
    readRampleLabels: async () => ({
      kits: {
        TestKit: { label: 'TestKit', voiceNames: { ...initialVoiceNames } }
      }
    }),
    writeRampleLabels: async () => {},
    listFilesInRoot: async () => files // still needed for initial load
  };
}

describe('KitDetails voice rescanning', () => {
  it('rescans a single voice and updates only that voice', async () => {
    mockElectronAPI(['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav'], { 1: '', 2: '', 3: '', 4: '' });
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    await screen.findByText('Kick');
    // Simulate rescan for voice 2
    const rescanButtons = screen.getAllByTitle('Rescan voice name');
    fireEvent.click(rescanButtons[1]); // Voice 2
    await waitFor(() => expect(screen.getByText('Snare')).toBeInTheDocument());
    expect(screen.getByText('Kick')).toBeInTheDocument();
    expect(screen.getByText('Snare')).toBeInTheDocument();
    expect(screen.getByText('Hat')).toBeInTheDocument();
    expect(screen.getByText('Tom')).toBeInTheDocument();
  });
  it('rescans all voices and updates all names', async () => {
    mockElectronAPI(['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav'], { 1: '', 2: '', 3: '', 4: '' });
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    await screen.findByText('Kick');
    // Simulate rescan all
    const rescanAll = screen.getByText('Rescan All Kit Voice Names');
    fireEvent.click(rescanAll);
    await waitFor(() => expect(screen.getByText('Kick')).toBeInTheDocument());
    expect(screen.getByText('Snare')).toBeInTheDocument();
    expect(screen.getByText('Hat')).toBeInTheDocument();
    expect(screen.getByText('Tom')).toBeInTheDocument();
  });
  it('always shows all four voices, even if no match', async () => {
    mockElectronAPI(['1 Kick.wav'], { 1: '', 2: '', 3: '', 4: '' });
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    await screen.findByText('Kick');
    expect(screen.getAllByText('No voice name set').length).toBe(3);
  });
});

// Mock canvas getContext for jsdom
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function () { return null; } as any;
});
