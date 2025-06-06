import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import KitDetails from '../KitDetails';

// Helper to mock electronAPI with dynamic state
function mockElectronAPI({ files = [], voiceNames = {}, updateVoiceNames }: {
  files?: string[];
  voiceNames?: any;
  updateVoiceNames?: () => any;
} = {}) {
  let currentVoiceNames = { ...voiceNames };
  (window as any).electronAPI = {
    readRampleLabels: async () => {
      if (updateVoiceNames) {
        const updated = updateVoiceNames();
        if (updated) currentVoiceNames = { ...updated };
      }
      return {
        kits: {
          TestKit: { label: 'TestKit', voiceNames: { ...currentVoiceNames } }
        }
      };
    },
    writeRampleLabels: async () => {},
    listFilesInRoot: async () => files,
    onSamplePlaybackEnded: () => {},
    onSamplePlaybackError: () => {},
  };
}

describe('KitDetails voice name controls', () => {
  it('shows edit/rescan controls and a no-name indicator if no voice name is set', async () => {
    mockElectronAPI({ voiceNames: { 1: '', 2: '', 3: '', 4: '' } });
    render(
      <KitDetails
        kitName="TestKit"
        sdCardPath="/sd"
        onBack={() => {}}
      />
    );
    const noNameIndicators = await screen.findAllByText('No voice name set');
    expect(noNameIndicators.length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Edit voice name').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Rescan voice name').length).toBeGreaterThan(0);
  });
  it('auto-scans all voice names if none are set', async () => {
    mockElectronAPI({
      files: ['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav'],
      voiceNames: { 1: 'Kick', 2: 'Snare', 3: 'Hat', 4: 'Tom' }
    });
    render(
      <KitDetails
        kitName="TestKit"
        sdCardPath="/sd"
        onBack={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('voice-name-1')).toHaveTextContent('Kick'));
    expect(screen.getByTestId('voice-name-1')).toHaveTextContent('Kick');
    expect(screen.getByTestId('voice-name-2')).toHaveTextContent('Snare');
    expect(screen.getByTestId('voice-name-3')).toHaveTextContent('Hat');
    expect(screen.getByTestId('voice-name-4')).toHaveTextContent('Tom');
  });
});

describe('KitDetails voice rescanning', () => {
  it('rescans a single voice and updates only that voice', async () => {
    let updated = false;
    mockElectronAPI({
      files: ['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav'],
      voiceNames: { 1: '', 2: '', 3: '', 4: '' },
      updateVoiceNames: () => updated ? { 1: 'Kick', 2: 'Snare', 3: 'Hat', 4: 'Tom' } : undefined
    });
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const noNameIndicators = await screen.findAllByText('No voice name set');
    expect(noNameIndicators.length).toBeGreaterThanOrEqual(4);
    const rescanButtons = screen.getAllByTitle('Rescan voice name');
    updated = true;
    fireEvent.click(rescanButtons[1]);
    await waitFor(() => expect(screen.getByTestId('voice-name-1')).toHaveTextContent('Kick'));
    expect(screen.getByTestId('voice-name-1')).toHaveTextContent('Kick');
    expect(screen.getByTestId('voice-name-2')).toHaveTextContent('Snare');
    expect(screen.getByTestId('voice-name-3')).toHaveTextContent('Hat');
    expect(screen.getByTestId('voice-name-4')).toHaveTextContent('Tom');
    expect(screen.queryByText('No voice name set')).toBeNull();
  });
  it('rescans all voices and updates all names', async () => {
    let updated = false;
    mockElectronAPI({
      files: ['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav'],
      voiceNames: { 1: '', 2: '', 3: '', 4: '' },
      updateVoiceNames: () => updated ? { 1: 'Kick', 2: 'Snare', 3: 'Hat', 4: 'Tom' } : undefined
    });
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const noNameIndicators = await screen.findAllByText('No voice name set');
    expect(noNameIndicators.length).toBeGreaterThanOrEqual(4);
    const rescanAll = screen.getByRole('button', { name: /rescan kit voice names/i });
    updated = true;
    fireEvent.click(rescanAll);
    await waitFor(() => expect(screen.getByTestId('voice-name-1')).toHaveTextContent('Kick'));
    expect(screen.getByTestId('voice-name-1')).toHaveTextContent('Kick');
    expect(screen.getByTestId('voice-name-2')).toHaveTextContent('Snare');
    expect(screen.getByTestId('voice-name-3')).toHaveTextContent('Hat');
    expect(screen.getByTestId('voice-name-4')).toHaveTextContent('Tom');
    expect(screen.queryByText('No voice name set')).toBeNull();
  });
  it('always shows all four voices, even if no match', async () => {
    mockElectronAPI({
      files: ['1 Kick.wav'],
      voiceNames: { 1: 'Kick', 2: '', 3: '', 4: '' }
    });
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const noNameIndicators = await screen.findAllByText('No voice name set');
    expect(noNameIndicators.length).toBeGreaterThanOrEqual(4);
    await waitFor(() => expect(screen.getByTestId('voice-name-1')).toHaveTextContent('Kick'));
    expect(screen.getByTestId('voice-name-1')).toHaveTextContent('Kick');
    expect(screen.queryAllByText('No voice name set').length).toBe(3);
  });
});

describe('KitDetails full kit preview controls', () => {
  beforeEach(() => {
    (window as any).electronAPI = {
      playKitPreview: vi.fn(),
      stopKitPreview: vi.fn(),
      onSamplePlaybackEnded: () => {},
      onSamplePlaybackError: () => {},
      readRampleLabels: vi.fn().mockResolvedValue({
        kits: { TestKit: { label: 'TestKit', voiceNames: { 1: '', 2: '', 3: '', 4: '' } } }
      }),
      writeRampleLabels: vi.fn(),
      listFilesInRoot: vi.fn().mockResolvedValue([]),
    };
  });
  afterEach(() => {
    cleanup();
  });
  it('renders play/stop controls for full kit preview and toggles state', async () => {
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const playBtn = screen.getByTestId('play-kit-preview');
    expect(playBtn).toBeInTheDocument();
    expect(playBtn).toHaveAttribute('aria-label', 'Play kit preview');
    fireEvent.click(playBtn);
    // Button should now be stop
    await waitFor(() => expect(screen.getByTestId('stop-kit-preview')).toBeInTheDocument());
    const stopBtn = screen.getByTestId('stop-kit-preview');
    expect(stopBtn).toHaveAttribute('aria-label', 'Stop kit preview');
    fireEvent.click(stopBtn);
    // Button should return to play
    await waitFor(() => expect(screen.getByTestId('play-kit-preview')).toBeInTheDocument());
  });
  it('calls electronAPI.playKitPreview and stopKitPreview', async () => {
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const playBtn = screen.getByTestId('play-kit-preview');
    fireEvent.click(playBtn);
    expect((window as any).electronAPI.playKitPreview).toHaveBeenCalled();
    const stopBtn = await screen.findByTestId('stop-kit-preview');
    fireEvent.click(stopBtn);
    expect((window as any).electronAPI.stopKitPreview).toHaveBeenCalled();
  });
});

describe('KitDetails step sequencer grid', () => {
  it('renders a 4x16 step grid with color-coded rows and toggleable steps', () => {
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const grid = screen.getByTestId('kit-step-sequencer');
    // 4 rows
    for (let v = 0; v < 4; v++) {
      expect(screen.getByTestId(`seq-voice-label-${v}`)).toBeInTheDocument();
      for (let s = 0; s < 16; s++) {
        const btn = screen.getByTestId(`seq-step-${v}-${s}`);
        expect(btn).toBeInTheDocument();
        // Initially off
        expect(btn).toHaveClass('bg-gray-300');
      }
    }
    // Toggle a step and check color
    const stepBtn = screen.getByTestId('seq-step-2-5');
    fireEvent.click(stepBtn);
    expect(stepBtn).toHaveClass('bg-yellow-500');
  });

  it('step sequencer grid and buttons have fixed size', () => {
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const grid = screen.getByTestId('kit-step-sequencer-grid');
    // Check Tailwind classes for fixed sizing
    expect(grid.className).toMatch(/w-\[600px\]/);
    expect(grid.className).toMatch(/min-w-\[600px\]/);
    expect(grid.className).toMatch(/max-w-\[600px\]/);
    for (let v = 0; v < 4; v++) {
      for (let s = 0; s < 16; s++) {
        const btn = screen.getByTestId(`seq-step-${v}-${s}`);
        // Check Tailwind classes for 32px sizing (w-8, h-8, min-w-8, min-h-8, max-w-8, max-h-8)
        expect(btn.className).toMatch(/w-8/);
        expect(btn.className).toMatch(/h-8/);
        expect(btn.className).toMatch(/min-w-8/);
        expect(btn.className).toMatch(/min-h-8/);
        expect(btn.className).toMatch(/max-w-8/);
        expect(btn.className).toMatch(/max-h-8/);
      }
    }
  });

  it('step sequencer drawer can be shown and hidden with animation', () => {
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const handle = screen.getByTestId('kit-step-sequencer-handle');
    const drawer = screen.getByTestId('kit-step-sequencer-drawer');
    // Drawer should be open by default
    expect(drawer.className).toMatch(/max-h-\[400px\]/);
    expect(drawer.className).toMatch(/opacity-100/);
    // Click handle to hide
    fireEvent.click(handle);
    expect(drawer.className).toMatch(/max-h-0/);
    expect(drawer.className).toMatch(/opacity-0/);
    // Click handle to show again
    fireEvent.click(handle);
    expect(drawer.className).toMatch(/max-h-\[400px\]/);
    expect(drawer.className).toMatch(/opacity-100/);
  });

  it('supports keyboard navigation and toggling of steps', async () => {
    render(<KitDetails kitName="TestKit" sdCardPath="/sd" onBack={() => {}} />);
    const grid = screen.getByTestId('kit-step-sequencer-grid');
    grid.focus();
    // Initial focus is on (0,0)
    let btn = screen.getByTestId('seq-step-0-0');
    expect(screen.getByTestId('seq-step-focus-ring')).toBeVisible();
    // Arrow right moves focus to (0,1)
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    btn = screen.getByTestId('seq-step-0-1');
    expect(screen.getByTestId('seq-step-focus-ring')).toBeVisible();
    // Arrow down moves to (1,1)
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    btn = screen.getByTestId('seq-step-1-1');
    expect(screen.getByTestId('seq-step-focus-ring')).toBeVisible();
    // Arrow left wraps to (1,0)
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    btn = screen.getByTestId('seq-step-1-0');
    expect(screen.getByTestId('seq-step-focus-ring')).toBeVisible();
    // Arrow up wraps to (0,0)
    fireEvent.keyDown(grid, { key: 'ArrowUp' });
    btn = screen.getByTestId('seq-step-0-0');
    expect(screen.getByTestId('seq-step-focus-ring')).toBeVisible();
    // Space toggles step
    expect(btn).toHaveClass('bg-gray-300');
    fireEvent.keyDown(grid, { key: ' ' });
    expect(btn).toHaveClass('bg-blue-500');
    // Enter toggles step off
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(btn).toHaveClass('bg-gray-300');
    // Clicking a step sets focus
    const btn2 = screen.getByTestId('seq-step-2-5');
    fireEvent.click(btn2);
    expect(screen.getByTestId('seq-step-focus-ring')).toBeVisible();
  });
});

// Mock canvas getContext for jsdom
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function () { return null; } as any;
});

beforeEach(() => {
  mockElectronAPI({
    voiceNames: { 1: '', 2: '', 3: '', 4: '' }
  });
});

afterEach(() => {
  // Clean up global electronAPI mock to prevent test leakage
  cleanup();
});
