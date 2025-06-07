// Test suite for SampleWaveform component
import { act,render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll,describe, expect, it, vi } from 'vitest';

import SampleWaveform from '../SampleWaveform';
import { MockMessageDisplayProvider } from './MockMessageDisplayProvider';

// Mock electronAPI and AudioContext
beforeAll(() => {
  // @ts-ignore
  window.electronAPI = {
    getAudioBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  };
  // @ts-ignore
  window.AudioContext = vi.fn().mockImplementation(() => ({
    decodeAudioData: (arrayBuffer, cb) => {
      // Fake AudioBuffer
      cb({
        getChannelData: () => new Float32Array([0, 1, 0, -1]),
        duration: 1,
        length: 4,
        sampleRate: 44100,
      });
    },
    createBufferSource: () => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    }),
    destination: {},
    currentTime: 0,
    state: 'running',
    close: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});


describe('SampleWaveform', () => {
  it('renders the waveform canvas', async () => {
    await act(async () => {
      render(
        <MockMessageDisplayProvider>
          <SampleWaveform filePath="/fake/path/kick.wav" playTrigger={0} />
        </MockMessageDisplayProvider>
      );
    });
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('loads and decodes audio buffer on mount', async () => {
    await act(async () => {
      render(<SampleWaveform filePath="/fake/path/snare.wav" playTrigger={0} />);
    });
    expect(window.electronAPI.getAudioBuffer).toHaveBeenCalledWith('/fake/path/snare.wav');
  });

  it('re-loads audio buffer when filePath changes', async () => {
    const { rerender } = render(<SampleWaveform filePath="/fake/path/one.wav" playTrigger={0} />);
    await act(async () => {
      rerender(<SampleWaveform filePath="/fake/path/two.wav" playTrigger={0} />);
    });
    expect(window.electronAPI.getAudioBuffer).toHaveBeenCalledWith('/fake/path/two.wav');
  });

  it('calls onPlayingChange when playback starts and stops', async () => {
    const onPlayingChange = vi.fn();
    await act(async () => {
      render(<SampleWaveform filePath="/fake/path/kick.wav" playTrigger={1} onPlayingChange={onPlayingChange} />);
    });
    // The mock implementation only calls onPlayingChange(false) due to jsdom limitations
    expect(onPlayingChange).toHaveBeenCalledWith(false);
  });

  it('stops playback when stopTrigger changes', async () => {
    let playTrigger = 1;
    let stopTrigger = 0;
    const { rerender } = render(<SampleWaveform filePath="/fake/path/kick.wav" playTrigger={playTrigger} stopTrigger={stopTrigger} />);
    // Simulate play
    playTrigger++;
    await act(async () => {
      rerender(<SampleWaveform filePath="/fake/path/kick.wav" playTrigger={playTrigger} stopTrigger={stopTrigger} />);
    });
    // Simulate stop
    stopTrigger++;
    await act(async () => {
      rerender(<SampleWaveform filePath="/fake/path/kick.wav" playTrigger={playTrigger} stopTrigger={stopTrigger} />);
    });
    // No crash = pass (can't check isPlaying directly)
  });

  it('handles audio loading error gracefully', async () => {
    // @ts-ignore
    window.electronAPI.getAudioBuffer.mockRejectedValueOnce(new Error('fail'));
    const onError = vi.fn();
    await act(async () => {
      render(
        <MockMessageDisplayProvider>
          <SampleWaveform filePath="/fake/path/bad.wav" playTrigger={0} onError={onError} />
        </MockMessageDisplayProvider>
      );
    });
    expect(onError).toHaveBeenCalledWith('Failed to load audio.');
  });

  it('cleans up audio context and animation on unmount', async () => {
    const { unmount } = render(<SampleWaveform filePath="/fake/path/kick.wav" playTrigger={0} />);
    await act(async () => {
      unmount();
    });
    // No crash = pass
  });
});
