import { describe, it, expect } from '@jest/globals';
import { getNextKitSlot } from '../src/renderer/components/KitBrowser';

describe('getNextKitSlot', () => {
    it('returns A0 if no kits exist', () => {
        expect(getNextKitSlot([])).toBe('A0');
    });
    it('returns next number in same bank', () => {
        expect(getNextKitSlot(['A0', 'A1', 'A2'])).toBe('A3');
    });
    it('rolls over to next bank after 99', () => {
        expect(getNextKitSlot(['A98', 'A99'])).toBe('B0');
    });
    it('skips filled slots', () => {
        expect(getNextKitSlot(['A0', 'A1', 'A2', 'A3'])).toBe('A4');
        expect(getNextKitSlot(['A0', 'A1', 'A2', 'A3', 'A4'])).toBe('A5');
    });
    it('returns null if all slots are filled', () => {
        const all = [];
        for (let bank = 65; bank <= 90; bank++) {
            for (let num = 0; num <= 99; num++) {
                all.push(String.fromCharCode(bank) + num);
            }
        }
        expect(getNextKitSlot(all)).toBe(null);
    });
    it('skips invalid kit names', () => {
        expect(getNextKitSlot(['A0', 'foo', 'B1'])).toBe('B2');
    });
    it('handles non-sequential kits', () => {
        expect(getNextKitSlot(['A0', 'A2', 'A3'])).toBe('A4');
    });
});
