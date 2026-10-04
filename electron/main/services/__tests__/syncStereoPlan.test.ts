import type { Sample } from "@romper/shared/db/schema.js";

import { describe, expect, it } from "vitest";

import { planWriteStereo } from "../syncStereoPlan.js";

// #537 final stereo rules v2, as a write applies them to every kit

const sample = (kit: string, voice: number, filename: string): Sample =>
  ({
    filename,
    kit_name: kit,
    slot_number: 0,
    source_path: `/s/${filename}`,
    voice_number: voice,
    wav_channels: null,
  }) as Sample;
const voice = (
  kit: string,
  voice_number: number,
  stereo_mode = false,
  stereo_choice: "mono" | "stereo" | null = null,
) => ({ kit_name: kit, stereo_choice, stereo_mode, voice_number });

describe("[UC-34] planWriteStereo", () => {
  it("links automatically, mixes down and quarantines, by kit, from the files' headers", () => {
    const samples = [
      sample("A0", 1, "pad.wav"), // stereo, voice 2 free: linked
      sample("A0", 4, "hat.wav"), // stereo on voice 4: mixed down
      sample("B1", 1, "pad.wav"), // a pair...
      sample("B1", 1, "kick.wav"), // ...with a mono sample: quarantined
    ];
    const plan = planWriteStereo(
      samples,
      [
        { channels: 2, unreadable: false },
        { channels: 2, unreadable: false },
        { channels: 2, unreadable: false },
        { channels: 1, unreadable: false },
      ],
      [
        voice("A0", 1),
        voice("A0", 2),
        voice("A0", 4),
        voice("B1", 1, true, "stereo"),
      ],
    );

    expect(plan.summary).toEqual({
      autoLinks: [{ kitName: "A0", voiceNumber: 1 }],
      mixdowns: [{ kitName: "A0", reason: "mono_voice", voiceNumber: 4 }],
      quarantined: [
        {
          kitName: "B1",
          problems: [
            { filename: "kick.wav", kind: "mono_in_pair", voiceNumber: 1 },
          ],
        },
      ],
    });
    expect([...plan.quarantinedKits]).toEqual(["B1"]);
    // The write mixes down from these: A0's voice 1 is now linked
    expect(plan.effectiveVoices).toContainEqual(
      expect.objectContaining({
        kit_name: "A0",
        stereo_mode: true,
        voice_number: 1,
      }),
    );
  });

  it("quarantines a kit with a WAV that can't be read", () => {
    const plan = planWriteStereo(
      [sample("C2", 2, "bad.wav")],
      [{ unreadable: true }],
      [voice("C2", 2)],
    );
    expect(plan.summary.quarantined).toEqual([
      {
        kitName: "C2",
        problems: [{ filename: "bad.wav", kind: "unreadable", voiceNumber: 2 }],
      },
    ]);
  });

  it("uses the store's channel count when a file wasn't read", () => {
    const plan = planWriteStereo(
      [{ ...sample("D3", 1, "pad.wav"), wav_channels: 2 }],
      [{ unreadable: false }],
      [voice("D3", 1, false, "mono")],
    );
    expect(plan.summary.mixdowns).toEqual([
      { kitName: "D3", reason: "mono_voice", voiceNumber: 1 },
    ]);
  });
});
