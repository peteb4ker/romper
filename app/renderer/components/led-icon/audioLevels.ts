// Module-level singleton store for real-time audio levels.
// Written at ~60fps by SampleWaveform's rAF loop, read at ~60fps by LED animation loop.
// No React dependencies — pure module state.

export interface VoiceLevel {
  isStereo: boolean;
  left: number; // 0-1 RMS
  right: number; // 0-1 RMS
}

const levels = new Map<number, VoiceLevel>();

export function clearAllLevels(): void {
  levels.clear();
}

export function clearVoiceLevel(voice: number): void {
  levels.delete(voice);
}

export function getAllLevels(): Map<number, VoiceLevel> {
  return levels;
}

export function getVoiceLevel(voice: number): undefined | VoiceLevel {
  return levels.get(voice);
}

export function hasActiveVoices(): boolean {
  return levels.size > 0;
}

export function setVoiceLevel(voice: number, level: VoiceLevel): void {
  levels.set(voice, level);
}
