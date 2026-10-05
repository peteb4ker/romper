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

/** ARIA roles whose widgets take Space themselves, as a native button does. */
const SPACE_ROLES = new Set([
  "button",
  "checkbox",
  "menuitem",
  "radio",
  "switch",
  "tab",
]);

/**
 * True when Space on this element does something of its own: presses a
 * button, ticks a box, opens a select or types a space. A window-level
 * Space shortcut, such as the kit editor's "play the selected sample",
 * leaves these presses to the control (#613).
 */
export function usesSpaceItself(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) {
    return false;
  }
  if (["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return SPACE_ROLES.has(el.getAttribute("role") ?? "");
}
