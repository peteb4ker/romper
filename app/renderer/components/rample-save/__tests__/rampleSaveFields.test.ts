import { RAMPLE_KIT_SAVE_KEYS } from "@romper/shared/rampleSave";
import { describe, expect, it } from "vitest";

import {
  firmwareRelease,
  formatRampleValue,
  RAMPLE_VOICE_FIELDS,
  voiceRows,
} from "../rampleSaveFields";
import { RAMPLE_SAVE_TEXT } from "../rampleSaveText";

describe("[Q-08] the On the Rample section's fields (#800)", () => {
  it("covers every per-voice key of a kit file, once, by the device's key", () => {
    const perVoice = Object.entries(RAMPLE_KIT_SAVE_KEYS)
      .filter(([field]) => field !== "assignments" && field !== "muteGroup")
      .map(([, key]) => key)
      .sort();
    expect(RAMPLE_VOICE_FIELDS.map((info) => info.deviceKey).sort()).toEqual(
      perVoice,
    );
  });

  it("keeps every meaning inferred until a hardware check confirms it", () => {
    // Change a field to "confirmed" only with the check's result recorded in
    // docs/developer/rample-save-integration.md
    expect(
      RAMPLE_VOICE_FIELDS.filter((info) => info.meaning !== "inferred"),
    ).toEqual([]);
  });

  it("turns a kit's values into rows of four, leaving gaps where the file has none", () => {
    const rows = voiceRows({ level: [42, 127, 127], pitch: [1, 2, 3, 4] });
    const byKey = Object.fromEntries(
      rows.map((row) => [row.info.deviceKey, row.values]),
    );
    expect(byKey.level).toEqual([42, 127, 127, undefined]);
    expect(byKey.pitch).toEqual([1, 2, 3, 4]);
    expect(byKey.filter).toEqual([undefined, undefined, undefined, undefined]);
  });

  it.each([
    [1, "1"],
    [false, "false"],
    [null, "null"],
    ["hi", '"hi"'],
    [[1, [true]], "[1, [true]]"],
    [
      {
        entries: [
          ["b", 1],
          ["a", 2],
        ],
      },
      "{b: 1, a: 2}",
    ],
    [{ opaque: { majorType: 2, size: 5 } }, RAMPLE_SAVE_TEXT.opaqueValue(2, 5)],
  ] as const)("shows %j as %s", (value, shown) => {
    expect(formatRampleValue(value as never)).toBe(shown);
  });

  it("names the firmware release a guess points to, or none", () => {
    const guess = {
      candidates: ["2.00"],
      evidence: [],
      inferred: true,
      label: "",
    } as const;
    expect(firmwareRelease({ ...guess, candidates: ["2.00"] })).toBe("2.00");
    expect(firmwareRelease({ ...guess, candidates: ["2.00", "3.00"] })).toBe(
      "2.00/3.00",
    );
    expect(firmwareRelease({ ...guess, candidates: [] })).toBeUndefined();
    expect(firmwareRelease(undefined)).toBeUndefined();
  });
});
