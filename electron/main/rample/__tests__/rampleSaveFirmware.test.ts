import { describe, expect, it } from "vitest";

import { syntheticSettings } from "../../../../tests/factories/rampleSave.factory";
import {
  guessFirmwareFromSettingsKeys,
  unknownFirmware,
} from "../rampleSaveFirmware";

const keysOf = (map: Map<string, unknown>) => [...map.keys()];

describe("[Q-08] guessing the firmware from settings.rpl's keys (#788)", () => {
  it("takes a 2.00-style key set as 2.00, inferred, with the keys it used", () => {
    const guess = guessFirmwareFromSettingsKeys(keysOf(syntheticSettings()));

    expect(guess).toMatchObject({
      atLeast: "2.00",
      before: "3.00",
      candidates: ["2.00"],
      inferred: true,
    });
    expect(guess.label).toBe(
      "2.00 (inferred from settings.rpl's keys: 2.00 or later, before 3.00)",
    );
    expect(guess.evidence).toContainEqual({
      key: "slicer_quantize_postv200",
      present: true,
      says: "2.00 or later (the SLICER list 2.00 rewrote)",
    });
    expect(guess.evidence).toContainEqual(
      expect.objectContaining({
        present: false,
        says: expect.stringMatching(/before 3\.00/),
      }),
    );
  });

  it("takes a pre-2.00 key set as before 2.00", () => {
    const settings = syntheticSettings();
    settings.delete("slicer_quantize_postv200");
    // The pre-2.00 SLICER key is expected, under a name nobody has seen
    settings.set("slicer_quantize", 2);

    const guess = guessFirmwareFromSettingsKeys(keysOf(settings));

    expect(guess).toMatchObject({
      atLeast: "1.50",
      before: "2.00",
      candidates: ["1.50"],
    });
    expect(guess.evidence).toContainEqual(
      expect.objectContaining({
        key: "slicer_quantize_postv200",
        present: false,
      }),
    );
    expect(guess.evidence).toContainEqual(
      expect.objectContaining({ key: "slicer_quantize", present: true }),
    );
  });

  it("leaves 3.00 open when a 2.00 key set has extra keys", () => {
    const keys = [...keysOf(syntheticSettings()), "compressor", "tape"];

    const guess = guessFirmwareFromSettingsKeys(keys);

    expect(guess.atLeast).toBe("2.00");
    expect(guess.before).toBeUndefined();
    expect(guess.candidates).toEqual(["2.00", "3.00"]);
    expect(guess.label).toBe(
      "2.00/3.00 (inferred from settings.rpl's keys: 2.00 or later)",
    );
    expect(guess.evidence.filter((e) => e.key === "tape")).toHaveLength(1);
  });

  it("says unknown firmware for a key set that matches nothing", () => {
    const guess = guessFirmwareFromSettingsKeys(["volume", "tempo"]);

    expect(guess).toEqual({
      candidates: [],
      evidence: [],
      inferred: true,
      label: "unknown firmware (no settings key a known firmware writes)",
    });
    expect(guessFirmwareFromSettingsKeys([]).candidates).toEqual([]);
  });

  it("keeps the range wide when only old keys are there", () => {
    const guess = guessFirmwareFromSettingsKeys(["midi_velocity", "note_sp1"]);

    expect(guess.atLeast).toBeUndefined();
    expect(guess.candidates).toEqual(["1.1", "1.2", "1.3", "1.4", "1.50"]);
    expect(guess.label).toBe(
      "1.1/1.2/1.3/1.4/1.50 (inferred from settings.rpl's keys: before 2.00)",
    );
  });

  it("labels a file without a marker with the folder's guess", () => {
    const folder = guessFirmwareFromSettingsKeys(keysOf(syntheticSettings()));
    const guess = unknownFirmware("kit files have no firmware marker", folder);

    expect(guess.folder).toBe(folder);
    expect(guess.candidates).toEqual([]);
    expect(guess.label).toBe(
      `unknown (kit files have no firmware marker); the folder looks like ${folder.label}`,
    );
  });
});
