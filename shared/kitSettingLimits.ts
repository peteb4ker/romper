/**
 * The values Romper accepts for kit and voice settings. Main refuses
 * anything outside them (RE-25), so a glitch in the renderer can't save a
 * setting outside them.
 *
 * The BPM, voice volume, sample gain and sample mode ranges are Romper's
 * design, not the Rample's. The Rample manual describes no step sequencer
 * or BPM, voice volume isn't written to the card, and the module's layer
 * modes (Settings) are "MANUAL, RANDOM, CYCLIC, REVERSE CYCLIC, VELOCITY",
 * not Romper's sample modes.
 */

export const VOICE_COUNT = 4;
export const SLOTS_PER_VOICE = 12;

/** Voice volume, a whole number (`voices.voice_volume`) */
export const VOICE_VOLUME_MIN = 0;
export const VOICE_VOLUME_MAX = 100;

/** Per-sample gain trim in dB (`samples.gain_db`); fractions are fine */
export const SAMPLE_GAIN_DB_MIN = -24;
export const SAMPLE_GAIN_DB_MAX = 12;

/** Step sequencer tempo, a whole number of BPM (`kits.bpm`) */
export const KIT_BPM_MIN = 30;
export const KIT_BPM_MAX = 180;

/** How a voice with several samples picks one (`voices.sample_mode`) */
export const SAMPLE_MODES = ["first", "random", "round-robin"] as const;
export type SampleMode = (typeof SAMPLE_MODES)[number];
