import { act,renderHook } from '@testing-library/react';
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import { getNextKitSlot } from '../../kitUtils';
import { useKitBrowser } from '../useKitBrowser';

// Mock kitUtils
vi.mock('../../kitUtils', () => ({
  getNextKitSlot: vi.fn(() => 'A1'),
  toCapitalCase: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}));

// Mock electronAPI
let mockListFilesInRoot: any;
let mockCreateKit: any;
let mockCopyKit: any;
let mockSelectSdCard: any;
let mockSetSetting: any;

beforeEach(() => {
  mockListFilesInRoot = vi.fn();
  mockCreateKit = vi.fn();
  mockCopyKit = vi.fn();
  mockSelectSdCard = vi.fn();
  mockSetSetting = vi.fn();
  global.window = Object.create(window);
  window.electronAPI = {
    listFilesInRoot: mockListFilesInRoot,
    createKit: mockCreateKit,
    copyKit: mockCopyKit,
    selectSdCard: mockSelectSdCard,
    setSetting: mockSetSetting,
  };
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useKitBrowser', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useKitBrowser({ kits: ['A1'], sdCardPath: '/sd', onRefreshKits: undefined }));
    expect(result.current.kits).toEqual(['A1']);
    expect(result.current.showNewKit).toBe(false);
    expect(result.current.newKitSlot).toBe('');
    expect(result.current.duplicateKitSource).toBe(null);
  });

  it('sets nextKitSlot when kits change', () => {
    // Ensure getNextKitSlot mock returns 'A1' for this test
    getNextKitSlot.mockReturnValue('A1');
    const { result, rerender } = renderHook(({ kits }) => useKitBrowser({ kits, sdCardPath: '/sd' }), { initialProps: { kits: ['A1'] } });
    expect(result.current.nextKitSlot).toBe('A1');
    rerender({ kits: ['A1', 'B2'] });
    expect(result.current.nextKitSlot).toBe('A1'); // Because of the mock
  });

  it('loads bankNames from rtf files', async () => {
    mockListFilesInRoot.mockResolvedValue(['A - alpha.rtf', 'B - beta.rtf', 'foo.txt']);
    const { result } = renderHook(() => useKitBrowser({ kits: ['A1'], sdCardPath: '/sd' }));
    // Wait for useEffect
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.bankNames).toEqual({ A: 'Alpha', B: 'Beta' });
  });

  it('handleCreateKit validates and calls electronAPI', async () => {
    mockCreateKit.mockResolvedValue(undefined);
    const onRefreshKits = vi.fn();
    const { result } = renderHook(() => useKitBrowser({ kits: ['A1'], sdCardPath: '/sd', onRefreshKits }));
    act(() => { result.current.setNewKitSlot('A2'); });
    await act(async () => {
      await result.current.handleCreateKit();
    });
    expect(mockCreateKit).toHaveBeenCalledWith('/sd', 'A2');
    expect(onRefreshKits).toHaveBeenCalled();
  });

  it('handleCreateKit sets error for invalid slot', async () => {
    const { result } = renderHook(() => useKitBrowser({ kits: ['A1'], sdCardPath: '/sd' }));
    act(() => { result.current.setNewKitSlot('bad'); });
    await act(async () => {
      await result.current.handleCreateKit();
    });
    expect(result.current.newKitError).toMatch(/Invalid kit slot/);
  });

  it('handleDuplicateKit validates and calls electronAPI', async () => {
    mockCopyKit.mockResolvedValue(undefined);
    const onRefreshKits = vi.fn();
    const { result } = renderHook(() => useKitBrowser({ kits: ['A1'], sdCardPath: '/sd', onRefreshKits }));
    await act(async () => {
      result.current.setDuplicateKitSource('A1');
      result.current.setDuplicateKitDest('B2');
    });
    await act(async () => {
      await result.current.handleDuplicateKit();
    });
    expect(mockCopyKit).toHaveBeenCalledWith('/sd', 'A1', 'B2');
    expect(onRefreshKits).toHaveBeenCalled();
  });

  it('handleBankClick scrolls to the correct element', () => {
    const scrollTo = vi.fn();
    const getBoundingClientRect = vi.fn(() => ({ top: 100, left: 0, right: 0, bottom: 0, width: 0, height: 0 }));
    const el = { getBoundingClientRect };
    const container = { getBoundingClientRect, scrollTop: 0, scrollTo };
    vi.spyOn(document, 'getElementById').mockReturnValue(el as any);
    vi.spyOn(document, 'querySelector').mockReturnValue({ offsetHeight: 0 } as any);
    const { result } = renderHook(() => useKitBrowser({ kits: ['A1'], sdCardPath: '/sd' }));
    result.current.scrollContainerRef.current = container as any;
    act(() => {
      result.current.handleBankClick('A');
    });
    expect(scrollTo).toHaveBeenCalled();
  });
});
