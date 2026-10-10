import { describe, expect, it } from "vitest";

import {
  checkStereoLink,
  describeLinkRefusal,
  describeMissingSampleFile,
  describeMixdownNote,
  describeMonoOnStereoPair,
  describeQuarantinedKit,
  describeQuarantineProblem,
  describeSetupAutoLink,
  describeStereoDropPrompt,
  describeUnlink,
  describeWriteAutoLink,
  describeWriteMixdown,
  isKitQuarantined,
  isLinkedAutomatically,
  planKitStereo,
  QUARANTINE_ICON_LABEL,
  QUARANTINE_NOTICE,
  SAMPLE_FILE_LABELS,
  STEREO_LABELS,
  type StereoSampleState,
  type StereoVoiceState,
} from "../stereoLinkRules";

// The "Final stereo rules v2" on #537

const mono = (voice_number: number, filename = "m.wav"): StereoSampleState => ({
  filename,
  voice_number,
  wav_channels: 1,
});
const stereo = (
  voice_number: number,
  filename = "s.wav",
): StereoSampleState => ({ filename, voice_number, wav_channels: 2 });

/** Four voices; `linked` linked, `monoChosen` kept mono by the user */
function voices(
  linked: number[] = [],
  monoChosen: number[] = [],
): StereoVoiceState[] {
  return [1, 2, 3, 4].map((voice_number) => ({
    stereo_choice: monoChosen.includes(voice_number) ? "mono" : null,
    stereo_mode: linked.includes(voice_number),
    voice_number,
  }));
}

describe("[UC-28] checkStereoLink: linking by hand (#541)", () => {
  it.each([1, 2, 3])(
    "allows voice %s when the next voice has no samples",
    (n) => {
      expect(checkStereoLink(n, voices(), [mono(n)])).toEqual({
        canLink: true,
      });
    },
  );

  it("refuses a voice whose next voice has samples", () => {
    expect(checkStereoLink(2, voices(), [mono(3)])).toEqual({
      canLink: false,
      message: "Voices 2 and 3 can't be linked: voice 3 has samples.",
      reason: "next_voice_has_samples",
    });
  });

  it("refuses voice 4", () => {
    expect(checkStereoLink(4, voices(), [])).toMatchObject({
      message: "Voice 4 can't be linked.",
      reason: "no_next_voice",
    });
  });

  it("refuses a voice in a pair, either side, and one next to a pair", () => {
    expect(checkStereoLink(2, voices([1]), [])).toMatchObject({
      message:
        "Voices 2 and 3 can't be linked: voice 2 is already in a stereo pair.",
    });
    expect(checkStereoLink(3, voices([3]), [])).toMatchObject({
      reason: "voice_in_pair",
    });
    expect(checkStereoLink(1, voices([2]), [])).toMatchObject({
      message:
        "Voices 1 and 2 can't be linked: voice 2 is already in a stereo pair.",
      reason: "next_voice_in_pair",
    });
  });
});

describe("[UC-01] [UC-34] planKitStereo: rule 1, a mono voice is always fine", () => {
  it.each([
    ["stereo samples on voice 4", [stereo(4)], 4],
    ["mixed samples on an unlinked voice", [stereo(1), mono(1)], 1],
    ["stereo samples whose next voice has samples", [stereo(2), mono(3)], 2],
  ])("mixes down %s, without quarantine", (_, samples, voiceNumber) => {
    const plan = planKitStereo(voices(), samples);
    expect(plan.autoLinks).toEqual([]);
    expect(plan.mixdowns).toEqual([{ reason: "mono_voice", voiceNumber }]);
    expect(plan.quarantine).toEqual([]);
  });

  it("leaves a mono voice of mono samples alone", () => {
    expect(planKitStereo(voices(), [mono(1)])).toEqual({
      autoLinks: [],
      links: [],
      mixdowns: [],
      quarantine: [],
    });
  });
});

describe("[UC-01] [UC-34] planKitStereo: rule 2, linking automatically", () => {
  it("links voice N when every sample on it is stereo and N+1 is free", () => {
    const plan = planKitStereo(voices(), [stereo(1), stereo(1)]);
    expect(plan.autoLinks).toEqual([1]);
    expect(plan.links).toEqual([1]);
    expect(plan.mixdowns).toEqual([]);
  });

  it("doesn't link a voice the user kept mono", () => {
    const plan = planKitStereo(voices([], [1]), [stereo(1)]);
    expect(plan.autoLinks).toEqual([]);
    expect(plan.mixdowns).toEqual([{ reason: "mono_voice", voiceNumber: 1 }]);
  });

  it("takes voices in order: voice 1 can't take voice 2, which takes voice 3", () => {
    const plan = planKitStereo(voices(), [stereo(1), stereo(2)]);
    expect(plan.autoLinks).toEqual([2]);
    expect(plan.mixdowns).toEqual([{ reason: "mono_voice", voiceNumber: 1 }]);
  });

  it("ignores unknown channel counts", () => {
    const plan = planKitStereo(voices(), [
      { filename: "x.wav", voice_number: 1, wav_channels: null },
    ]);
    expect(plan.autoLinks).toEqual([]);
  });
});

describe("[UC-28] planKitStereo: rule 3, never undo links", () => {
  it("keeps an empty pair, and notes why the voice before it can't pair", () => {
    const plan = planKitStereo(voices([2]), [stereo(1)]);
    expect(plan.links).toEqual([2]);
    expect(plan.autoLinks).toEqual([]);
    expect(plan.mixdowns).toEqual([
      { reason: "next_voice_in_pair", voiceNumber: 1 },
    ]);
    expect(describeMixdownNote(plan.mixdowns[0])).toBe(
      "Voice 1 can't pair with voice 2 because voices 2 and 3 are linked. Unlink them to pair voices 1 and 2.",
    );
  });
});

describe("[UC-28] [UC-34] planKitStereo: rule 4, quarantine", () => {
  it("quarantines a pair with a mono sample on its voice (#574)", () => {
    expect(
      planKitStereo(voices([1]), [stereo(1), mono(1, "kick.wav")]).quarantine,
    ).toEqual([{ filename: "kick.wav", kind: "mono_in_pair", voiceNumber: 1 }]);
  });

  it("quarantines a pair whose right voice has samples", () => {
    expect(
      planKitStereo(voices([1]), [stereo(1), stereo(2)]).quarantine,
    ).toEqual([{ kind: "right_voice_has_samples", voiceNumber: 1 }]);
  });

  it("quarantines a kit with a WAV that can't be read", () => {
    expect(
      planKitStereo(voices(), [
        { filename: "bad.wav", unreadable: true, voice_number: 3 },
      ]).quarantine,
    ).toEqual([{ filename: "bad.wav", kind: "unreadable", voiceNumber: 3 }]);
  });

  it("doesn't quarantine a clean pair", () => {
    expect(planKitStereo(voices([3]), [stereo(3)]).quarantine).toEqual([]);
  });
});

describe("[UC-28] isLinkedAutomatically", () => {
  it("is a link with no choice by hand", () => {
    expect(
      isLinkedAutomatically({
        stereo_choice: null,
        stereo_mode: true,
        voice_number: 1,
      }),
    ).toBe(true);
    expect(
      isLinkedAutomatically({
        stereo_choice: "stereo",
        stereo_mode: true,
        voice_number: 1,
      }),
    ).toBe(false);
  });
});

describe("[UC-01] [UC-19] [UC-28] [UC-34] the stereo wording (#537, #574)", () => {
  it("keeps the approved messages", () => {
    expect(describeStereoDropPrompt("kick.wav", 1)).toBe(
      "kick.wav is stereo. Link voices 1 and 2 as a stereo pair?",
    );
    expect(describeMonoOnStereoPair("kick.wav", 1)).toBe(
      "kick.wav is a mono sample, but voices 1 and 2 are a stereo pair and expect stereo samples.",
    );
    expect(describeLinkRefusal(2, "next_voice_has_samples")).toBe(
      "Voices 2 and 3 can't be linked: voice 3 has samples.",
    );
    expect(describeUnlink(1, true)).toBe(
      "Voices 1 and 2 are unlinked. Voice 1's stereo samples will be written to the card as mono.",
    );
  });

  it("has the draft labels, notes and summary lines", () => {
    expect(STEREO_LABELS).toEqual({
      linkedAutomatically: "Linked automatically",
      monoInPair: "Mono sample in a stereo pair",
      quarantined: "Quarantined",
    });
    expect(describeMixdownNote({ reason: "mono_voice", voiceNumber: 2 })).toBe(
      "Mixed down to mono instead of playing across 2 voices",
    );
    expect(describeSetupAutoLink("A0", 1)).toBe(
      "Kit A0: voices 1 and 2 linked automatically as a stereo pair.",
    );
    expect(describeWriteAutoLink("A0", 1)).toBe(
      "Kit A0: voices 1 and 2 will be linked automatically as a stereo pair.",
    );
    expect(describeWriteMixdown("A0", 3)).toBe(
      "Kit A0: voice 3's stereo samples will be mixed down to mono.",
    );
    expect(describeQuarantinedKit("A0")).toBe(
      "Kit A0 is quarantined, so it won't be written and its copy on the card stays as it is.",
    );
    expect(QUARANTINE_NOTICE).toBe(
      "This kit is quarantined: it won't be written to the card until this is fixed.",
    );
    expect(
      describeQuarantineProblem({
        filename: "kick.wav",
        kind: "mono_in_pair",
        voiceNumber: 1,
      }),
    ).toBe(
      "kick.wav is a mono sample in the stereo pair on voices 1 and 2. Unlink them, or replace kick.wav with a stereo sample.",
    );
    expect(
      describeQuarantineProblem({
        kind: "right_voice_has_samples",
        voiceNumber: 1,
      }),
    ).toBe(
      "Voices 1 and 2 are a stereo pair, but voice 2 has samples. Unlink them, or remove the samples from voice 2.",
    );
    expect(
      describeQuarantineProblem({
        filename: "bad.wav",
        kind: "unreadable",
        voiceNumber: 1,
      }),
    ).toBe(
      "Romper can't read bad.wav. Replace it with a WAV Romper can read, or remove it.",
    );
  });

  it("never says busy or in use", () => {
    const all = [
      describeLinkRefusal(1, "next_voice_in_pair"),
      describeLinkRefusal(2, "voice_in_pair"),
      describeMixdownNote({ reason: "next_voice_in_pair", voiceNumber: 1 }),
      QUARANTINE_NOTICE,
      describeQuarantinedKit("A0"),
    ].join(" ");
    expect(all).not.toMatch(/busy|in use/i);
  });
});

describe("[UC-08] [UC-34] isKitQuarantined: from what the store recorded", () => {
  const stored = (
    voice_number: number,
    wav_channels: null | number,
    source_status: null | string = "readable",
  ) => ({ filename: "x.wav", source_status, voice_number, wav_channels });

  it("is quarantined by a sample last found unreadable", () => {
    expect(isKitQuarantined(voices(), [stored(1, null, "unreadable")])).toBe(
      true,
    );
  });

  it("isn't quarantined by missing metadata or a missing file", () => {
    expect(
      isKitQuarantined(voices(), [
        stored(1, null, null),
        stored(2, null, "missing"),
      ]),
    ).toBe(false);
  });

  it("is quarantined by a mono sample in a stereo pair", () => {
    expect(isKitQuarantined(voices([1]), [stored(1, 1)])).toBe(true);
  });
});

describe("[UC-08] file labels and guidance (#537; drafts)", () => {
  it("has the per-sample labels, the icon label and the missing-file guidance", () => {
    expect(SAMPLE_FILE_LABELS).toEqual({
      missing: "File not found",
      unreadable: "Can't be read",
    });
    expect(QUARANTINE_ICON_LABEL).toBe(
      "Quarantined: this kit won't be written to the card until it's fixed",
    );
    expect(describeMissingSampleFile("kick.wav", 2)).toBe(
      "kick.wav on voice 2 wasn't found: it was moved or deleted. Put it back, or replace or remove the sample. Until then it's skipped when you write to the card.",
    );
  });
});
