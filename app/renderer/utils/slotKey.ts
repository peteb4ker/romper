/**
 * Key for per-slot state in the kit editor: playback triggers, playing state
 * and sample metadata such as gain. Keyed by voice and zero-based slot, never
 * by file name: one voice can hold two files with the same name, and so can
 * two voices (RE-45).
 */
export function slotKey(voice: number, slot: number): string {
  return `${voice}:${slot}`;
}
