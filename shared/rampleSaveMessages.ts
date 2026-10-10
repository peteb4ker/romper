/**
 * What Romper says when it couldn't keep a copy of the card's `_save`
 * folder (#802, stage 2 of #786). Setup and the write carry on without it.
 * Wording approved on 2026-10-09 (#802). A card that stops
 * responding during the copy stops setup or the write instead, with the
 * messages in cardMessages.ts.
 */

/** After setup from a card */
export const RAMPLE_SAVE_SETUP_BACKUP_FAILED_MESSAGE =
  "Romper couldn't keep a copy of the Rample's saved settings (the card's _save folder). Your kits were set up. To keep a copy, copy that folder from the card yourself.";

/** After a write to the card */
export const RAMPLE_SAVE_WRITE_BACKUP_FAILED_MESSAGE =
  "Romper couldn't keep a copy of the Rample's saved settings (the card's _save folder) before writing. The write went ahead, and that folder on the card wasn't changed.";
