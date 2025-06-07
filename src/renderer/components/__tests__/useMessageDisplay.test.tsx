vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

import { act,renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import { useMessageDisplay } from '../hooks/useMessageDisplay';

describe('useMessageDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('returns the correct API', () => {
    const { result } = renderHook(() => useMessageDisplay());
    expect(typeof result.current.showMessage).toBe('function');
    expect(typeof result.current.dismissMessage).toBe('function');
    expect(typeof result.current.clearMessages).toBe('function');
    expect(Array.isArray(result.current.messages)).toBe(true);
  });

  it('calls toast with correct arguments', () => {
    const { result } = renderHook(() => useMessageDisplay());
    act(() => {
      result.current.showMessage('Test info', 'info', 1234);
    });
    expect(toast).toHaveBeenCalledWith('Test info', expect.objectContaining({ type: 'info', duration: 1234 }));
  });

  it('dismissMessage and clearMessages are callable and do nothing', () => {
    const { result } = renderHook(() => useMessageDisplay());
    expect(() => result.current.dismissMessage('id')).not.toThrow();
    expect(() => result.current.clearMessages()).not.toThrow();
  });
});
