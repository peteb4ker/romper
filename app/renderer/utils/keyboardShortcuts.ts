/**
 * The key that bookmarks the focused kit in the kit browser. Letters jump
 * to banks, so the bookmark is not a letter: "F" used to do both (RE-38).
 */
export const FAVORITE_KEY = "*";

/**
 * True when Cmd, Ctrl or Alt is held. Single-key shortcuts (bank letters,
 * the bookmark, kit navigation, the sequencer toggle) ignore these presses,
 * so menu accelerators such as Cmd+, and system combinations such as
 * Ctrl+A don't also trigger them (RE-38). Shift is allowed: some layouts
 * need it to type "*".
 */
export function hasCommandModifier(
  e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey">,
): boolean {
  return e.metaKey || e.ctrlKey || e.altKey;
}
