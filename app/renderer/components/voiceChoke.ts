/**
 * Voice choke at the audio layer: a Rample voice is monophonic, so a sound
 * starting on a voice stops whatever else is sounding on it, whichever slot
 * or component started it.
 *
 * React state also chokes (useKitPlayback), but that state is keyed by file
 * name and resets on every kit refresh (RE-13, RE-45). This registry holds
 * the live sounds themselves, so the choke can't be lost.
 */

/** Stops one sound at `atMs` (a performance.now() time), or now. */
export type StopSound = (atMs?: number) => void;

const sounding = new Map<number, Set<StopSound>>();

/**
 * Register a sound starting on `voice` at `atMs` (performance.now() time,
 * or now), stopping every other sound on the voice as it starts. Returns
 * a release function to call when the sound ends or is stopped.
 */
export function claimVoice(
  voice: number,
  stop: StopSound,
  atMs?: number,
): () => void {
  let sounds = sounding.get(voice);
  if (!sounds) {
    sounds = new Set();
    sounding.set(voice, sounds);
  }
  for (const other of [...sounds]) {
    sounds.delete(other);
    other(atMs);
  }
  sounds.add(stop);
  const claimed = sounds;
  return () => {
    claimed.delete(stop);
  };
}

/** For tests: how many sounds a voice has registered. */
export function soundingCount(voice: number): number {
  return sounding.get(voice)?.size ?? 0;
}
