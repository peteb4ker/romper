import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/romperDbCoreORM.js", () => ({
  getKit: vi.fn(),
}));

import type { SyncFileOperation } from "../syncFileOperations.js";

import { getKit } from "../../db/romperDbCoreORM.js";
import {
  annotateMonoConversion,
  buildVoiceStereoModeCache,
  extractVoiceNumber,
} from "../syncMonoAnnotation.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractVoiceNumber", () => {
  it("extracts voice number from standard path", () => {
    expect(extractVoiceNumber("kitName/1/sample.wav")).toBe(1);
    expect(extractVoiceNumber("kitName/4/sample.wav")).toBe(4);
  });

  it("returns undefined for non-numeric path segments", () => {
    expect(extractVoiceNumber("kitName/abc/sample.wav")).toBeUndefined();
    expect(extractVoiceNumber("sample.wav")).toBeUndefined();
  });

  it("returns undefined for empty path", () => {
    expect(extractVoiceNumber("")).toBeUndefined();
  });
});

describe("buildVoiceStereoModeCache", () => {
  it("builds cache from kit voices", () => {
    vi.mocked(getKit).mockReturnValue({
      data: {
        voices: [
          { stereo_mode: false, voice_number: 1 },
          { stereo_mode: true, voice_number: 2 },
        ],
      },
      success: true,
    } as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
      },
    ];

    const cache = buildVoiceStereoModeCache(files, "/db");
    expect(cache.get("myKit:1")).toBe(false);
    expect(cache.get("myKit:2")).toBe(true);
    expect(getKit).toHaveBeenCalledWith("/db", "myKit");
  });

  it("only loads each kit once", () => {
    vi.mocked(getKit).mockReturnValue({
      data: { voices: [{ stereo_mode: false, voice_number: 1 }] },
      success: true,
    } as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/a.wav",
        filename: "a.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/a.wav",
      },
      {
        destinationPath: "myKit/1/b.wav",
        filename: "b.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/b.wav",
      },
    ];

    buildVoiceStereoModeCache(files, "/db");
    expect(getKit).toHaveBeenCalledTimes(1);
  });

  it("handles kit lookup failure gracefully", () => {
    vi.mocked(getKit).mockImplementation(() => {
      throw new Error("DB error");
    });

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
      },
    ];

    const cache = buildVoiceStereoModeCache(files, "/db");
    expect(cache.get("myKit:1")).toBeUndefined();
    expect(cache.get("myKit:loaded")).toBe(true);
  });

  it("handles kit with no voices", () => {
    vi.mocked(getKit).mockReturnValue({
      data: { voices: undefined },
      success: true,
    } as unknown as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/sample.wav",
        filename: "sample.wav",
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
      },
    ];

    const cache = buildVoiceStereoModeCache(files, "/db");
    expect(cache.get("myKit:1")).toBeUndefined();
  });
});

describe("annotateMonoConversion", () => {
  it("sets forceMonoConversion for stereo files on mono voices", () => {
    vi.mocked(getKit).mockReturnValue({
      data: {
        voices: [{ stereo_mode: false, voice_number: 1 }],
      },
      success: true,
    } as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/sample.wav",
        filename: "sample.wav",
        isStereo: true,
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
      },
    ];

    annotateMonoConversion(files, "/db");

    expect(files[0].forceMonoConversion).toBe(true);
    expect(files[0].operation).toBe("convert");
    expect(files[0].reason).toBe(
      "Stereo sample on mono voice requires mono conversion",
    );
  });

  it("does not modify mono files on mono voices", () => {
    vi.mocked(getKit).mockReturnValue({
      data: {
        voices: [{ stereo_mode: false, voice_number: 1 }],
      },
      success: true,
    } as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/sample.wav",
        filename: "sample.wav",
        isStereo: false,
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
      },
    ];

    annotateMonoConversion(files, "/db");

    expect(files[0].forceMonoConversion).toBeUndefined();
    expect(files[0].operation).toBe("copy");
  });

  it("does not modify stereo files on stereo voices", () => {
    vi.mocked(getKit).mockReturnValue({
      data: {
        voices: [{ stereo_mode: true, voice_number: 1 }],
      },
      success: true,
    } as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/sample.wav",
        filename: "sample.wav",
        isStereo: true,
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
      },
    ];

    annotateMonoConversion(files, "/db");

    expect(files[0].forceMonoConversion).toBeUndefined();
    expect(files[0].operation).toBe("copy");
  });

  it("preserves convert operation when already set", () => {
    vi.mocked(getKit).mockReturnValue({
      data: {
        voices: [{ stereo_mode: false, voice_number: 1 }],
      },
      success: true,
    } as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/sample.wav",
        filename: "sample.wav",
        isStereo: true,
        kitName: "myKit",
        operation: "convert",
        reason: "Format conversion required",
        sourcePath: "/src/sample.wav",
      },
    ];

    annotateMonoConversion(files, "/db");

    expect(files[0].forceMonoConversion).toBe(true);
    expect(files[0].operation).toBe("convert");
    expect(files[0].reason).toBe("Format conversion required");
  });

  it("skips files with unparseable voice numbers", () => {
    vi.mocked(getKit).mockReturnValue({
      data: {
        voices: [{ stereo_mode: false, voice_number: 1 }],
      },
      success: true,
    } as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "sample.wav",
        filename: "sample.wav",
        isStereo: true,
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
      },
    ];

    annotateMonoConversion(files, "/db");

    expect(files[0].forceMonoConversion).toBeUndefined();
    expect(files[0].operation).toBe("copy");
  });

  it("does not annotate when voice stereo_mode is undefined", () => {
    vi.mocked(getKit).mockReturnValue({
      data: { voices: [] },
      success: true,
    } as ReturnType<typeof getKit>);

    const files: SyncFileOperation[] = [
      {
        destinationPath: "myKit/1/sample.wav",
        filename: "sample.wav",
        isStereo: true,
        kitName: "myKit",
        operation: "copy",
        sourcePath: "/src/sample.wav",
      },
    ];

    annotateMonoConversion(files, "/db");

    expect(files[0].forceMonoConversion).toBeUndefined();
    expect(files[0].operation).toBe("copy");
  });
});
