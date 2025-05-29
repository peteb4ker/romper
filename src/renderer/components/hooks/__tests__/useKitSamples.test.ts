// Test suite for useKitSamples hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKitSamples } from '../useKitSamples';

describe('useKitSamples', () => {
  const kitName = 'TestKit';
  const sdCardPath = '/sd';
  const kitPath = `${sdCardPath}/${kitName}`;
  let listFilesInRoot: any;
  let setKitLabel: any;
  beforeEach(() => {
    listFilesInRoot = vi.fn();
    setKitLabel = vi.fn();
    window.electronAPI = { listFilesInRoot };
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses propSamples if provided', () => {
    const propSamples = { 1: ['kick.wav'], 2: ['snare.wav'] };
    const { result } = renderHook(() => useKitSamples({ kitName, sdCardPath, samples: propSamples }, setKitLabel));
    expect(result.current.samples).toEqual(propSamples);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loads samples from electronAPI and infers voiceNames', async () => {
    listFilesInRoot.mockResolvedValue(['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav']);
    const { result, waitForNextUpdate } = renderHook(() => useKitSamples({ kitName, sdCardPath }, setKitLabel));
    // Wait for async effect
    await act(async () => {
      await waitForNextUpdate();
    });
    expect(listFilesInRoot).toHaveBeenCalledWith(kitPath);
    expect(result.current.samples[1]).toContain('1 Kick.wav');
    expect(result.current.samples[2]).toContain('2 Snare.wav');
    expect(result.current.voiceNames).toBeDefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error if electronAPI fails', async () => {
    listFilesInRoot.mockRejectedValue(new Error('fail!'));
    const { result, waitForNextUpdate } = renderHook(() => useKitSamples({ kitName, sdCardPath }, setKitLabel));
    await act(async () => {
      await waitForNextUpdate();
    });
    expect(result.current.error).toBe('Failed to load kit samples.');
    expect(result.current.loading).toBe(false);
  });
});
