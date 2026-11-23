/**
 * What Romper says when the card watchdog gives up on an SD card operation
 * (#653): the card's driver stopped responding. Wording approved on
 * 2026-10-08 (#724).
 */

/** A write to the card stopped (#653) */
export const CARD_NOT_RESPONDING_MESSAGE =
  "The SD card stopped responding, so the write stopped. Eject and reinsert the card, then write again.";

/**
 * Setting up a local store from the card stopped (#724). Main reports it;
 * the setup wizard also recognizes it in its checks of the target folder.
 */
export const CARD_NOT_RESPONDING_SETUP_MESSAGE =
  "The SD card stopped responding, so setup stopped. Eject and reinsert the card, then try again.";

/**
 * A write requested while another is still running (#886). Main refuses
 * it and the running write carries on. The write dialog is modal, so this
 * normally can't be seen. Wording awaiting the maintainer's approval.
 */
export const WRITE_IN_PROGRESS_MESSAGE =
  "A write to the card is already in progress.";
