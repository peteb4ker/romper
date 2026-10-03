/**
 * True when Cmd, Ctrl or Alt is held. Single-key shortcuts (bank letters,
 * the star, kit navigation, the sequencer toggle) ignore these presses,
 * so menu accelerators such as Cmd+, and system combinations such as
 * Ctrl+A don't also trigger them (RE-38). Shift is allowed: the kit
 * browser stars with Shift+F.
 */
export function hasCommandModifier(
  e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey">,
): boolean {
  return e.metaKey || e.ctrlKey || e.altKey;
}

/**
 * True for the press that stars or unstars the focused kit in the kit
 * browser: Shift+F. Every plain letter jumps to its bank there, so plain
 * "F" stays the jump to bank F (RE-38, #504).
 */
export function isBrowserFavoriteKey(
  e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">,
): boolean {
  return e.shiftKey && !hasCommandModifier(e) && e.key.toLowerCase() === "f";
}

/**
 * True for the press that stars or unstars the open kit in the kit editor:
 * "F", with or without Shift. No other editor shortcut uses F (#504).
 */
export function isEditorFavoriteKey(
  e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey">,
): boolean {
  return !hasCommandModifier(e) && e.key.toLowerCase() === "f";
}
