import { describe, it, expect } from '@jest/globals';

function renameSampleForVoice(filename: string, voice: number): string {
  // Replace leading voice number (with dot/space or before uppercase letter) with new voice number
  return filename
    .replace(/^([1-4])(\.| )/, `${voice}$2`)
    .replace(/^([1-4])(?=[A-Z])/, `${voice}`);
}

describe('renameSampleForVoice', () => {
  it('keeps correct voice number if already matches', () => {
    expect(renameSampleForVoice('1. Kick 01.wav', 1)).toBe('1. Kick 01.wav');
    expect(renameSampleForVoice('1Kick 01.wav', 1)).toBe('1Kick 01.wav');
  });
  it('replaces voice number with new one (dot/space)', () => {
    expect(renameSampleForVoice('1. Kick 01.wav', 2)).toBe('2. Kick 01.wav');
    expect(renameSampleForVoice('1 Kick 01.wav', 3)).toBe('3 Kick 01.wav');
  });
  it('replaces voice number with new one (before uppercase)', () => {
    expect(renameSampleForVoice('1Kick 01.wav', 2)).toBe('2Kick 01.wav');
    expect(renameSampleForVoice('2Snare.wav', 4)).toBe('4Snare.wav');
  });
  it('leaves filename unchanged if no leading number', () => {
    expect(renameSampleForVoice('Kick 01.wav', 2)).toBe('Kick 01.wav');
    expect(renameSampleForVoice('Snare.wav', 3)).toBe('Snare.wav');
  });
});
