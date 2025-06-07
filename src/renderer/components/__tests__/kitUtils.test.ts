// Test suite for kitUtils module
import { describe, expect,it } from 'vitest';

import { useKitListLogic } from '../hooks/useKitListLogic';
import { compareKitSlots, getNextKitSlot,isValidKit, showBankAnchor, uniqueVoiceLabels } from '../kitUtils';

describe('kitUtils', () => {
  it('uniqueVoiceLabels returns unique, non-empty labels', () => {
    const voiceNames = { 1: 'Kick', 2: 'Kick', 3: 'Snare', 4: '' };
    expect(uniqueVoiceLabels(voiceNames)).toEqual(['Kick', 'Snare']);
  });

  it('isValidKit returns true for valid kit names', () => {
    expect(isValidKit('A1')).toBe(true);
    expect(isValidKit('B99')).toBe(true);
    expect(isValidKit('Z0')).toBe(true);
  });

  it('isValidKit returns false for invalid kit names', () => {
    expect(isValidKit('foo')).toBe(false);
    expect(isValidKit('A100')).toBe(false);
    expect(isValidKit('')).toBe(false);
  });

  it('showBankAnchor returns true for first kit in a bank', () => {
    expect(showBankAnchor('A1', 0, ['A1', 'A2', 'B1'])).toBe(true);
    expect(showBankAnchor('B1', 2, ['A1', 'A2', 'B1'])).toBe(true);
    expect(showBankAnchor('A2', 1, ['A1', 'A2', 'B1'])).toBe(false);
  });

  it('compareKitSlots sorts by bank then number', () => {
    expect([ 'B1', 'A2', 'A1' ].sort(compareKitSlots)).toEqual(['A1', 'A2', 'B1']);
    expect(compareKitSlots('A1', 'A2')).toBeLessThan(0);
    expect(compareKitSlots('B0', 'A99')).toBeGreaterThan(0);
    expect(compareKitSlots('A10', 'A2')).toBeGreaterThan(0);
  });

  it('getNextKitSlot finds the next available slot', () => {
    expect(getNextKitSlot(['A0', 'A1', 'A2'])).toBe('A3');
    expect(getNextKitSlot(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20', 'A21', 'A22', 'A23', 'A24', 'A25', 'A26', 'A27', 'A28', 'A29', 'A30', 'A31', 'A32', 'A33', 'A34', 'A35', 'A36', 'A37', 'A38', 'A39', 'A40', 'A41', 'A42', 'A43', 'A44', 'A45', 'A46', 'A47', 'A48', 'A49', 'A50', 'A51', 'A52', 'A53', 'A54', 'A55', 'A56', 'A57', 'A58', 'A59', 'A60', 'A61', 'A62', 'A63', 'A64', 'A65', 'A66', 'A67', 'A68', 'A69', 'A70', 'A71', 'A72', 'A73', 'A74', 'A75', 'A76', 'A77', 'A78', 'A79', 'A80', 'A81', 'A82', 'A83', 'A84', 'A85', 'A86', 'A87', 'A88', 'A89', 'A90', 'A91', 'A92', 'A93', 'A94', 'A95', 'A96', 'A97', 'A98', 'A99'])).toBe('B0');
    expect(getNextKitSlot([])).toBe('A0');
    // All slots taken
    const all = [];
    for (let bank of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      for (let num = 0; num <= 99; num++) {
        all.push(bank + num);
      }
    }
    expect(getNextKitSlot(all)).toBe(null);
  });
});
