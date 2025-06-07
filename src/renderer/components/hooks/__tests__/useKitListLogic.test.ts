import { renderHook } from '@testing-library/react';
import { describe, expect,it } from 'vitest';

import { useKitListLogic } from '../useKitListLogic';

describe('useKitListLogic', () => {
  it('sorts kits and provides helpers', () => {
    const kits = ['B2', 'A1', 'C3', 'A2'];
    const { result } = renderHook(() => useKitListLogic(kits));
    expect(result.current.kitsToDisplay).toEqual(['A1', 'A2', 'B2', 'C3']);
    expect(result.current.isValidKit('A1')).toBe(true);
    expect(result.current.isValidKit('bad')).toBe(false);
    expect(result.current.getColorClass('A1')).toMatch(/text/);
    expect(result.current.showBankAnchor('A1', 0, ['A1', 'A2', 'B2'])).toBe(true);
    expect(result.current.showBankAnchor('A2', 1, ['A1', 'A2', 'B2'])).toBe(false);
    expect(result.current.showBankAnchor('B2', 2, ['A1', 'A2', 'B2'])).toBe(true);
  });
});
