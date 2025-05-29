// Test suite for useKitLabel hook
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKitLabel } from '../useKitLabel';
import * as kitUtils from '../kitUtils';

const defaultKitName = 'TestKit';
const defaultSdCardPath = '/sd';
const defaultKitLabel = {
  label: defaultKitName,
  description: 'desc',
  tags: ['foo'],
  voiceNames: { 1: 'Kick', 2: 'Snare', 3: '', 4: '' },
};

function setupMocks(overrides = {}) {
  const readRampleLabels = vi.fn().mockResolvedValue({ kits: { [defaultKitName]: { ...defaultKitLabel, ...overrides } } });
  const writeRampleLabels = vi.fn().mockResolvedValue(undefined);
  window.electronAPI = {
    readRampleLabels,
    writeRampleLabels,
    listFilesInRoot: vi.fn().mockResolvedValue(['1 Kick.wav', '2 Snare.wav', '3 Hat.wav', '4 Tom.wav']),
  };
  return { readRampleLabels, writeRampleLabels };
}

describe('useKitLabel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads kit label and normalizes voiceNames', async () => {
    setupMocks({ voiceNames: undefined });
    const { result } = renderHook(() => useKitLabel({ kitName: defaultKitName, sdCardPath: defaultSdCardPath }));
    // Wait for async effect
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.kitLabel?.label).toBe(defaultKitName);
    expect(result.current.kitLabel?.voiceNames).toBeDefined();
    expect(result.current.kitLabel?.voiceNames).toHaveProperty('1');
    expect(result.current.kitLabel?.voiceNames).toHaveProperty('4');
  });

  it('handles error if readRampleLabels fails', async () => {
    window.electronAPI = {
      readRampleLabels: vi.fn().mockRejectedValue(new Error('fail')),
      writeRampleLabels: vi.fn(),
    };
    const { result } = renderHook(() => useKitLabel({ kitName: defaultKitName, sdCardPath: defaultSdCardPath }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.labelsError).toMatch(/Failed to load/);
  });

  it('saves kit label', async () => {
    const { writeRampleLabels } = setupMocks();
    const { result } = renderHook(() => useKitLabel({ kitName: defaultKitName, sdCardPath: defaultSdCardPath }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await result.current.handleSaveKitLabel('NewLabel');
    });
    expect(writeRampleLabels).toHaveBeenCalled();
    expect(result.current.kitLabel?.label).toBe('NewLabel');
  });

  it('saves kit tags', async () => {
    const { writeRampleLabels } = setupMocks();
    const { result } = renderHook(() => useKitLabel({ kitName: defaultKitName, sdCardPath: defaultSdCardPath }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await result.current.handleSaveKitTags(['bar', 'baz']);
    });
    expect(writeRampleLabels).toHaveBeenCalled();
    expect(result.current.kitLabel?.tags).toContain('bar');
  });

  it('saves kit metadata', async () => {
    const { writeRampleLabels } = setupMocks();
    const { result } = renderHook(() => useKitLabel({ kitName: defaultKitName, sdCardPath: defaultSdCardPath }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await result.current.handleSaveKitMetadata('MetaLabel', 'desc2', ['x']);
    });
    expect(writeRampleLabels).toHaveBeenCalled();
    expect(result.current.kitLabel?.label).toBe('MetaLabel');
    expect(result.current.kitLabel?.description).toBe('desc2');
    expect(result.current.kitLabel?.tags).toContain('x');
  });

  it('saves voice name', async () => {
    const { writeRampleLabels } = setupMocks();
    const { result } = renderHook(() => useKitLabel({ kitName: defaultKitName, sdCardPath: defaultSdCardPath }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await result.current.handleSaveVoiceName(2, 'Clap');
    });
    expect(writeRampleLabels).toHaveBeenCalled();
    expect(result.current.kitLabel?.voiceNames?.[2]).toBe('Clap');
  });

  it('rescans a single voice and infers name', async () => {
    const { writeRampleLabels } = setupMocks({ voiceNames: { 1: '', 2: '', 3: '', 4: '' } });
    const { result } = renderHook(() => useKitLabel({ kitName: defaultKitName, sdCardPath: defaultSdCardPath }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await result.current.handleRescanVoiceName(1, { 1: ['1 Kick.wav'], 2: [], 3: [], 4: [] });
    });
    expect(writeRampleLabels).toHaveBeenCalled();
    expect(result.current.kitLabel?.voiceNames?.[1]?.toLowerCase()).toContain('kick');
  });

  it('rescans all voices and infers names', async () => {
    const inferSpy = vi.spyOn(kitUtils, 'inferVoiceTypeFromFilename').mockReturnValue('mocked');
    const { writeRampleLabels } = setupMocks({ voiceNames: { 1: '', 2: '', 3: '', 4: '' } });
    const { result } = renderHook(() => useKitLabel({ kitName: defaultKitName, sdCardPath: defaultSdCardPath }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await result.current.handleRescanAllVoiceNames({
        1: ['1 Kick.wav'],
        2: ['2 Snare.wav'],
        3: ['3 Hat.wav'],
        4: ['4 Tom.wav'],
      });
    });
    expect(writeRampleLabels).toHaveBeenCalled();
    // Only check that a non-empty string is set for each voice name (mapping is tested elsewhere)
    expect(typeof result.current.kitLabel?.voiceNames?.[1]).toBe('string');
    expect(result.current.kitLabel?.voiceNames?.[1]).not.toBe('');
    expect(typeof result.current.kitLabel?.voiceNames?.[2]).toBe('string');
    expect(result.current.kitLabel?.voiceNames?.[2]).not.toBe('');
    expect(typeof result.current.kitLabel?.voiceNames?.[3]).toBe('string');
    expect(result.current.kitLabel?.voiceNames?.[3]).not.toBe('');
    expect(typeof result.current.kitLabel?.voiceNames?.[4]).toBe('string');
    expect(result.current.kitLabel?.voiceNames?.[4]).not.toBe('');
    // Assert inference function was called with each filename
    expect(inferSpy).toHaveBeenCalledWith('1 Kick.wav');
    expect(inferSpy).toHaveBeenCalledWith('2 Snare.wav');
    expect(inferSpy).toHaveBeenCalledWith('3 Hat.wav');
    expect(inferSpy).toHaveBeenCalledWith('4 Tom.wav');
    inferSpy.mockRestore();
  });
});
