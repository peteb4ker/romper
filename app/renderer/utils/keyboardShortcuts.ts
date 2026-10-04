/**
 * True when Cmd, Ctrl or Alt is held. Single-key shortcuts (bank letters,
 * the favorite key, kit navigation, the sequencer toggle) ignore these
 * presses, so menu accelerators such as Cmd+, and system combinations such
 * as Ctrl+A don't also trigger them (RE-38).
 */
export function hasCommandModifier(
  e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey">,
): boolean {
  return e.metaKey || e.ctrlKey || e.altKey;
}

/**
 * True for the press that makes a kit a favorite, or stops it being one:
 * ";" in both the kit browser (the focused kit) and the kit editor (the
 * open kit). A shortcut that works in the browser and elsewhere uses a
 * number or a special character, never a letter, since every letter jumps
 * to its bank in the browser (#552).
 *
 * Matches the character typed (`key`), not the physical key, so it follows
 * the keyboard layout.
 */
export function isFavoriteKey(
  e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey">,
): boolean {
  return !hasCommandModifier(e) && e.key === ";";
}
