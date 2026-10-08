/**
 * Voice choke at the audio layer: Romper plays each voice monophonically,
 * so a sound starting on a voice stops whatever else is sounding on it,
 * whichever slot or component started it. That's Romper's design: the
 * Rample manual doesn't describe a choke, so whether the module does the
 * same is unverified on hardware.
 *
 * The kit editor's playback state also chokes (useKitPlayback's handlePlay,
 * keyed by slot and not reset by a kit refresh since RE-13 and RE-45, in a
 * per-slot store since #482), but only the samples it started. This
 * registry holds the live sounds themselves, whatever started them, so
 * every sound on the voice is choked.
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
  // prettier-ignore
  for (const other of [...sounds]) { // NOSONAR - snapshot: stop callbacks may re-enter and change the set
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
