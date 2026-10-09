import { describe, expect, it } from "vitest";

import {
  describeConversionCount,
  describeTooShortCount,
  formatOfStoredSample,
  isShorterThanRampleMinimum,
  planConversion,
  type SampleFormat,
  WAV_FORMAT_TAGS,
  wavFormatTag,
} from "../rampleFormat";

const NATIVE: SampleFormat = {
  bitDepth: 16,
  channels: 1,
  encoding: "pcm",
  extensible: false,
  sampleRate: 44100,
};

describe("[UC-34] [Q-08] planConversion: the Rample format rule (#576)", () => {
  it("writes a 16- or 8-bit, 44.1 kHz PCM file as it is", () => {
    for (const bitDepth of [8, 16]) {
      expect(planConversion({ ...NATIVE, bitDepth })).toEqual({
        issues: [],
        mixdown: false,
        reason: null,
        unknown: false,
      });
    }
  });

  it.each<[string, SampleFormat, string]>([
    ["24-bit", { ...NATIVE, bitDepth: 24 }, "bitDepth"],
    ["48 kHz", { ...NATIVE, sampleRate: 48000 }, "sampleRate"],
    ["float", { ...NATIVE, bitDepth: 32, encoding: "float" }, "encoding"],
    ["extensible", { ...NATIVE, extensible: true }, "encoding"],
    ["more than two channels", { ...NATIVE, channels: 6 }, "channels"],
  ])("converts a %s file for its format", (_name, format, issueType) => {
    const plan = planConversion(format, { stereoVoice: true });
    expect(plan.reason).toBe("format");
    expect(plan.unknown).toBe(false);
    expect(plan.issues.map((issue) => issue.type)).toEqual([issueType]);
  });

  it("doesn't count a float file's bit depth as a second issue", () => {
    const plan = planConversion({ ...NATIVE, bitDepth: 32, encoding: "float" });
    expect(plan.issues).toHaveLength(1);
    expect(plan.issues[0].message).toBe(
      "32-bit float samples will be converted to 16-bit PCM.",
    );
  });

  describe("a stereo file, by the voice's stereo setting", () => {
    const stereo = { ...NATIVE, channels: 2 };

    it("is written as it is on a linked voice", () => {
      expect(planConversion(stereo, { stereoVoice: true })).toMatchObject({
        mixdown: false,
        reason: null,
      });
    });

    it("is mixed down to mono on an unlinked voice", () => {
      expect(planConversion(stereo, { stereoVoice: false })).toMatchObject({
        issues: [],
        mixdown: true,
        reason: "format",
      });
    });

    it("isn't mixed down when the voice isn't known", () => {
      expect(planConversion(stereo)).toMatchObject({
        mixdown: false,
        reason: null,
      });
    });

    it("leaves a mono file on a linked voice to the stereo rules (#537)", () => {
      expect(planConversion(NATIVE, { stereoVoice: true }).reason).toBeNull();
    });

    it("mixes a multichannel file down on an unlinked voice", () => {
      expect(
        planConversion({ ...NATIVE, channels: 4 }, { stereoVoice: false }),
      ).toMatchObject({ mixdown: true, reason: "format" });
    });
  });

  describe("gain", () => {
    it("re-encodes a native file with a gain adjustment, for gain", () => {
      expect(planConversion(NATIVE, { gainDb: -3 }).reason).toBe("gain");
      expect(planConversion(NATIVE, { gainDb: 12 }).reason).toBe("gain");
    });

    it("leaves a file at unity gain alone", () => {
      expect(planConversion(NATIVE, { gainDb: 0 }).reason).toBeNull();
      expect(planConversion(NATIVE, { gainDb: null }).reason).toBeNull();
    });

    it("counts a file needing both as a format conversion", () => {
      expect(
        planConversion({ ...NATIVE, sampleRate: 48000 }, { gainDb: -3 }).reason,
      ).toBe("format");
      expect(
        planConversion(
          { ...NATIVE, channels: 2 },
          { gainDb: -3, stereoVoice: false },
        ).reason,
      ).toBe("format");
    });
  });

  describe("missing values", () => {
    it("says the answer is unknown, not native", () => {
      expect(planConversion({})).toMatchObject({
        reason: null,
        unknown: true,
      });
      expect(planConversion({ bitDepth: 16, sampleRate: 44100 })).toMatchObject(
        { reason: null, unknown: true },
      );
    });

    it("converts when a known value already needs it", () => {
      expect(planConversion({ sampleRate: 48000 })).toMatchObject({
        reason: "format",
        unknown: false,
      });
    });

    it("re-encodes for gain whatever else is unknown", () => {
      expect(planConversion({}, { gainDb: -1 })).toMatchObject({
        reason: "gain",
        unknown: false,
      });
    });
  });
});

describe("[UC-34] [Q-08] isShorterThanRampleMinimum: the manual's 50 ms (#576)", () => {
  it("counts a file shorter than 50 ms", () => {
    expect(isShorterThanRampleMinimum({ frames: 882, sampleRate: 44100 })).toBe(
      true,
    );
    expect(
      isShorterThanRampleMinimum({ frames: 2204, sampleRate: 44100 }),
    ).toBe(true);
  });

  it("doesn't count a file of exactly 50 ms, or longer", () => {
    expect(
      isShorterThanRampleMinimum({ frames: 2205, sampleRate: 44100 }),
    ).toBe(false);
    expect(
      isShorterThanRampleMinimum({ frames: 2400, sampleRate: 48000 }),
    ).toBe(false);
    expect(
      isShorterThanRampleMinimum({ frames: 44100, sampleRate: 44100 }),
    ).toBe(false);
  });

  it("measures in time, whatever the sample rate", () => {
    // 2205 frames is 50 ms at 44.1 kHz but under it at 48 kHz
    expect(
      isShorterThanRampleMinimum({ frames: 2205, sampleRate: 48000 }),
    ).toBe(true);
  });

  it("doesn't count a file whose length isn't known", () => {
    expect(isShorterThanRampleMinimum({ sampleRate: 44100 })).toBe(false);
    expect(isShorterThanRampleMinimum({ frames: 10 })).toBe(false);
  });

  it("counts an empty file", () => {
    expect(isShorterThanRampleMinimum({ frames: 0, sampleRate: 44100 })).toBe(
      true,
    );
  });
});

describe("[UC-34] [Q-08] the write summary's wording (#576)", () => {
  it("says how many samples are converted, and why", () => {
    expect(describeConversionCount(2, 1)).toBe(
      "3 samples will be converted (2 for format, 1 for gain).",
    );
    expect(describeConversionCount(1, 0)).toBe(
      "1 sample will be converted (1 for format).",
    );
    expect(describeConversionCount(0, 1)).toBe(
      "1 sample will be converted (1 for gain).",
    );
    expect(describeConversionCount(0, 4)).toBe(
      "4 samples will be converted (4 for gain).",
    );
    expect(describeConversionCount(0, 0)).toBeNull();
  });

  it("warns about samples shorter than 50 ms", () => {
    expect(describeTooShortCount(2)).toBe(
      "2 samples are shorter than the Rample's 50 ms minimum.",
    );
    expect(describeTooShortCount(1)).toBe(
      "1 sample is shorter than the Rample's 50 ms minimum.",
    );
    expect(describeTooShortCount(0)).toBeNull();
  });
});

describe("[UC-34] the stored format tag (#576)", () => {
  it("records the header's encoding", () => {
    expect(wavFormatTag({ encoding: "pcm", extensible: false })).toBe(
      WAV_FORMAT_TAGS.pcm,
    );
    expect(wavFormatTag({ encoding: "float", extensible: false })).toBe(
      WAV_FORMAT_TAGS.float,
    );
    expect(wavFormatTag({ encoding: "float", extensible: true })).toBe(
      WAV_FORMAT_TAGS.extensible,
    );
    expect(wavFormatTag({})).toBeNull();
  });

  it("reads a stored sample's format back for the rule", () => {
    const columns = {
      wav_bit_depth: 16,
      wav_channels: 1,
      wav_sample_rate: 44100,
    };
    expect(
      formatOfStoredSample({
        ...columns,
        wav_format_tag: WAV_FORMAT_TAGS.extensible,
      }),
    ).toMatchObject({ extensible: true });
    expect(
      formatOfStoredSample({
        ...columns,
        wav_format_tag: WAV_FORMAT_TAGS.float,
      }),
    ).toMatchObject({ encoding: "float", extensible: false });
    // A row read before the tag was stored counts as plain PCM
    expect(
      planConversion(formatOfStoredSample({ ...columns, wav_format_tag: null }))
        .reason,
    ).toBeNull();
  });

  it("round-trips: a header's tag gives the rule the header's answer", () => {
    for (const header of [
      { ...NATIVE },
      { ...NATIVE, extensible: true },
      { ...NATIVE, bitDepth: 32, encoding: "float" as const },
    ]) {
      const stored = formatOfStoredSample({
        wav_bit_depth: header.bitDepth,
        wav_channels: header.channels,
        wav_format_tag: wavFormatTag(header),
        wav_sample_rate: header.sampleRate,
      });
      expect(planConversion(stored).reason).toBe(planConversion(header).reason);
    }
  });
});
