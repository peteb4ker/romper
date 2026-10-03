/**
 * The values the Rample accepts for kit and voice settings. Main refuses
 * anything outside them (RE-25), so a glitch in the renderer can't save a
 * setting the card can't use.
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
