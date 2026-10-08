/**
 * What Romper says when the card watchdog gives up on an SD card operation
 * (#653): the card's driver stopped responding. Wording approved by Pete,
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
