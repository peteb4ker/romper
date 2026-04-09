/**
 * Domain-specific fast-check generators for Romper PBT tests.
 * PBT-07 compliant: realistic, structured inputs with business constraints.
 */
import fc from "fast-check";

/** Valid bank letters A-Z */
export const bankLetterArb = fc.constantFrom(
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
);

/** Valid kit position within a bank (0-15) */
export const kitPositionArb = fc.integer({ max: 15, min: 0 });

/** Valid kit name (e.g., "A0", "B12", "Z15") */
export const kitNameArb = fc
  .tuple(bankLetterArb, kitPositionArb)
  .map(([letter, pos]) => `${letter}${pos}`);

/** Valid voice number (1-4) */
export const voiceNumberArb = fc.integer({ max: 4, min: 1 });

/** Valid slot number in DB format (0-11) */
export const slotNumberDbArb = fc.integer({ max: 11, min: 0 });

/** Valid slot number in UI format (1-12) */
export const slotNumberUiArb = fc.integer({ max: 12, min: 1 });

/** Valid gain in dB (-24 to +12) */
export const gainDbArb = fc.double({ max: 12, min: -24, noNaN: true });

/** Valid BPM (30-180) */
export const bpmArb = fc.integer({ max: 180, min: 30 });

/** Valid sample filename */
export const sampleFilenameArb = fc
  .tuple(
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,20}$/),
    fc.constantFrom(".wav", ".WAV"),
  )
  .map(([name, ext]) => `${name}${ext}`);

/** Valid source path */
export const sourcePathArb = fc
  .tuple(
    fc.constantFrom("/Users/test/samples", "/home/user/audio", "/mnt/sd"),
    sampleFilenameArb,
  )
  .map(([dir, file]) => `${dir}/${file}`);

/** Mock sample record */
export const sampleArb = fc.record({
  filename: sampleFilenameArb,
  gain_db: gainDbArb,
  id: fc.integer({ max: 10000, min: 1 }),
  is_stereo: fc.boolean(),
  kit_name: kitNameArb,
  slot_number: slotNumberDbArb,
  source_path: sourcePathArb,
  voice_number: voiceNumberArb,
});

/** Mock voice record */
export const voiceArb = fc.record({
  id: fc.integer({ max: 10000, min: 1 }),
  kit_name: kitNameArb,
  sample_mode: fc.constantFrom("first", "random", "round-robin"),
  stereo_mode: fc.boolean(),
  voice_alias: fc.option(fc.string({ maxLength: 20, minLength: 1 }), {
    nil: null,
  }),
  voice_number: voiceNumberArb,
  voice_volume: fc.integer({ max: 100, min: 0 }),
});
