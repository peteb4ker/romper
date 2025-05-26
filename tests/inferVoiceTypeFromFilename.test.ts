import { inferVoiceTypeFromFilename } from '../src/renderer/components/kitUtils';

describe('inferVoiceTypeFromFilename', () => {
  it('should infer snare from "2 SNARE LOW 01.wav"', () => {
    expect(inferVoiceTypeFromFilename('2 SNARE LOW 01.wav')).toBe('Snare');
  });

  it('should infer kick from "1 KICK LOW 01.wav"', () => {
    expect(inferVoiceTypeFromFilename('1 KICK LOW 01.wav')).toBe('Kick');
  });

  it('should infer ride from "3 RIDE HI 01.wav"', () => {
    expect(inferVoiceTypeFromFilename('3 RIDE HI 01.wav')).toBe('Ride');
  });

  it('should infer tom from "2 FLOOR TOM HI 01.wav"', () => {
    expect(inferVoiceTypeFromFilename('2 FLOOR TOM HI 01.wav')).toBe('Tom');
  });

  it('should infer rim from "3 RIM CLAP 01.wav"', () => {
    expect(inferVoiceTypeFromFilename('3 RIM CLAP 01.wav')).toBe('Rim');
  });

  it('should infer fx/laser from "4 LASERSN 01.wav" (precedence)', () => {
    expect(inferVoiceTypeFromFilename('4 LASERSN 01.wav')).toBe('Fx');
  });

  it('should infer hh_closed from "3 HH CLOSE 00.wav"', () => {
    expect(inferVoiceTypeFromFilename('3 HH CLOSE 00.wav')).toBe('Hh Closed');
  });

  it('should infer synth from "3Bell01.wav"', () => {
    expect(inferVoiceTypeFromFilename('3Bell01.wav')).toBe('Synth');
  });

  it('should infer synth from "2Stab02.wav"', () => {
    expect(inferVoiceTypeFromFilename('2Stab02.wav')).toBe('Synth');
  });

  it('should infer ride from "4 RIDE CHOKE 01.wav"', () => {
    expect(inferVoiceTypeFromFilename('4 RIDE CHOKE 01.wav')).toBe('Ride');
  });

  it('should infer loop from "1Loop_158_00.wav"', () => {
    expect(inferVoiceTypeFromFilename('1Loop_158_00.wav')).toBe('Loop');
  });

  it('should infer snare from "2Sn01.wav"', () => {
    expect(inferVoiceTypeFromFilename('2Sn01.wav')).toBe('Snare');
  });

  it('should infer conga from "3conga01.wav"', () => {
    expect(inferVoiceTypeFromFilename('3conga01.wav')).toBe('Conga');
  });

  it('should label "1 DD CHORD 1.wav" as "Synth" (chord test from inferVoiceTypeChord.test.ts)', () => {
    expect(inferVoiceTypeFromFilename('1 DD CHORD 1.wav')).toBe('Synth');
  });

  it('should infer snare from "2 AK SD.wav"', () => {
    expect(inferVoiceTypeFromFilename('2 AK SD.wav')).toBe('Snare');
  });
  it('should infer synth from "3 Saw 1.wav"', () => {
    expect(inferVoiceTypeFromFilename('3 Saw 1.wav')).toBe('Synth');
  });
  it('should infer synth from "1 Lead 1.wav"', () => {
    expect(inferVoiceTypeFromFilename('1 Lead 1.wav')).toBe('Synth');
  });
});
