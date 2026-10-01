/**
 * The one AudioContext every sample slot plays through (RE-14). Each slot
 * used to open its own, up to 48 per kit, each with its own audio thread
 * and output stream, and reopened it whenever its sample changed.
 *
 * Slots never close it. They build their own nodes on it (a volume gain
 * and level meters) and disconnect those when they let go of a sample.
 */
let shared: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!shared || shared.state === "closed") {
    const ctx = new globalThis.AudioContext();
    ctx.onstatechange = () => {
      // A context the OS suspends or interrupts (output device change,
      // sleep) plays nothing; make that visible instead of silent
      if (ctx.state !== "running" && ctx.state !== "closed") {
        console.warn(`[audio] AudioContext ${ctx.state}`);
      }
    };
    shared = ctx;
  }
  return shared;
}
