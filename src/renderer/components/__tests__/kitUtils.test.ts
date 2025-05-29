// Test suite for kitUtils module
import { describe, it, expect } from 'vitest';
import { uniqueVoiceLabels, isValidKit, getColorClass, showBankAnchor } from '../kitUtils';

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

  it('getColorClass returns a string', () => {
    expect(typeof getColorClass('A1')).toBe('string');
  });

  it('showBankAnchor returns true for first kit in a bank', () => {
    expect(showBankAnchor('A1', 0, ['A1', 'A2', 'B1'])).toBe(true);
    expect(showBankAnchor('B1', 2, ['A1', 'A2', 'B1'])).toBe(true);
    expect(showBankAnchor('A2', 1, ['A1', 'A2', 'B1'])).toBe(false);
  });
});
