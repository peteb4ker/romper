import { describe, it, expect } from '@jest/globals';
import { compareKitSlots } from '../src/renderer/components/kitUtils';

describe('compareKitSlots', () => {
    it('sorts by bank first', () => {
        expect(compareKitSlots('A0', 'B0')).toBeLessThan(0);
        expect(compareKitSlots('B0', 'A0')).toBeGreaterThan(0);
    });
    it('sorts by number within the same bank', () => {
        expect(compareKitSlots('A0', 'A1')).toBeLessThan(0);
        expect(compareKitSlots('A9', 'A10')).toBeLessThan(0);
        expect(compareKitSlots('A10', 'A9')).toBeGreaterThan(0);
        expect(compareKitSlots('A10', 'A10')).toBe(0);
    });
    it('sorts across banks and numbers', () => {
        expect(compareKitSlots('A99', 'B0')).toBeLessThan(0);
        expect(compareKitSlots('B0', 'A99')).toBeGreaterThan(0);
        expect(compareKitSlots('B10', 'B2')).toBeGreaterThan(0);
    });
    it('handles single digit vs double digit', () => {
        expect(compareKitSlots('A1', 'A10')).toBeLessThan(0);
        expect(compareKitSlots('A10', 'A1')).toBeGreaterThan(0);
    });
    it('returns 0 for identical slots', () => {
        expect(compareKitSlots('C42', 'C42')).toBe(0);
    });
});
