import { describe, expect, it } from "vitest";

import type { SyncFileOperation } from "../syncFileOperations.js";

import {
  annotateMonoConversion,
  buildVoiceStereoModeCache,
} from "../syncMonoAnnotation.js";

describe("[UC-28] buildVoiceStereoModeCache", () => {
  it("keys each voice's stereo setting by kit and voice", () => {
    const cache = buildVoiceStereoModeCache([
      { kit_name: "myKit", stereo_mode: false, voice_number: 1 },
      { kit_name: "myKit", stereo_mode: true, voice_number: 2 },
      { kit_name: "other", stereo_mode: true, voice_number: 1 },
    ]);
    expect(cache.get("myKit:1")).toBe(false);
    expect(cache.get("myKit:2")).toBe(true);
    expect(cache.get("other:1")).toBe(true);
  });

  it("has no entry for a voice the store doesn't have", () => {
    const cache = buildVoiceStereoModeCache([]);
    expect(cache.get("myKit:1")).toBeUndefined();
  });
});

describe("[UC-28] annotateMonoConversion", () => {
  it("sets forceMonoConversion for stereo files on mono voices", () => {
    const voices = [{ kit_name: "myKit", stereo_mode: false, voice_number: 1 }];

    const files: SyncFileOperation[] = [
      {
        channels: 2,
        destinationPath: "myKit/1-01 sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
        voiceNumber: 1,
      },
    ];

    annotateMonoConversion(files, voices);

    expect(files[0].forceMonoConversion).toBe(true);
    expect(files[0].operation).toBe("convert");
    expect(files[0].reason).toBe(
      "Stereo file on voice 1, which isn't linked as stereo: mixed to mono",
    );
  });

  it("does not modify mono files on mono voices", () => {
    const voices = [{ kit_name: "myKit", stereo_mode: false, voice_number: 1 }];

    const files: SyncFileOperation[] = [
      {
        channels: 1,
        destinationPath: "myKit/1-01 sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
        voiceNumber: 1,
      },
    ];

    annotateMonoConversion(files, voices);

    expect(files[0].forceMonoConversion).toBeUndefined();
    expect(files[0].operation).toBe("copy");
  });

  it("does not modify stereo files on stereo voices", () => {
    const voices = [{ kit_name: "myKit", stereo_mode: true, voice_number: 1 }];

    const files: SyncFileOperation[] = [
      {
        channels: 2,
        destinationPath: "myKit/1-01 sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
        voiceNumber: 1,
      },
    ];

    annotateMonoConversion(files, voices);

    expect(files[0].forceMonoConversion).toBeUndefined();
    expect(files[0].operation).toBe("copy");
  });

  it("preserves convert operation when already set", () => {
    const voices = [{ kit_name: "myKit", stereo_mode: false, voice_number: 1 }];

    const files: SyncFileOperation[] = [
      {
        channels: 2,
        destinationPath: "myKit/1-01 sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "convert",
        reason: "Format conversion required",
        sourcePath: "/src/sample.wav",
        voiceNumber: 1,
      },
    ];

    annotateMonoConversion(files, voices);

    expect(files[0].forceMonoConversion).toBe(true);
    expect(files[0].operation).toBe("convert");
    expect(files[0].reason).toBe("Format conversion required");
  });

  it("does not annotate when voice stereo_mode is undefined", () => {
    const voices = [];

    const files: SyncFileOperation[] = [
      {
        channels: 2,
        destinationPath: "myKit/1-01 sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
        voiceNumber: 1,
      },
    ];

    annotateMonoConversion(files, voices);

    expect(files[0].forceMonoConversion).toBeUndefined();
    expect(files[0].operation).toBe("copy");
  });

  it("leaves a file alone when its channel count is unknown", () => {
    const voices = [{ kit_name: "myKit", stereo_mode: false, voice_number: 1 }];

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1-01 sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
        voiceNumber: 1,
      },
    ];

    annotateMonoConversion(files, voices);

    expect(files[0].forceMonoConversion).toBeUndefined();
    expect(files[0].operation).toBe("copy");
  });
});
