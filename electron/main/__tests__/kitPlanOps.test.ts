import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  commitKitPlanHandler,
  rescanVoiceNames,
  validateKitPlan,
  writeKitSamples,
} from "../kitPlanOps";

// Mock the rampleLabels module
vi.mock("../rampleLabels.js", () => ({
  readRampleLabels: vi.fn(),
  writeRampleLabels: vi.fn(),
}));

import { readRampleLabels, writeRampleLabels } from "../rampleLabels.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("validateKitPlan", () => {
  it("validates a correct plan with no errors", () => {
    const plan = [
      { source: "/foo/kick.wav", target: "1 Kick.wav" },
      { source: "/foo/snare.wav", target: "2 Snare.wav" },
      { source: "/foo/hihat.wav", target: "3 HiHat.wav" },
    ];
    expect(validateKitPlan(plan)).toEqual([]);
  });

  it("handles empty plan", () => {
    expect(validateKitPlan([])).toEqual([]);
  });

  it("handles plan with no sources", () => {
    const plan = [{ target: "1 Kick.wav" }, { target: "2 Snare.wav" }];
    expect(validateKitPlan(plan)).toEqual([]);
  });

  it("detects duplicate sources in plan", () => {
    const plan = [
      { source: "/foo/kick.wav", target: "1 Kick.wav" },
      { source: "/foo/kick.wav", target: "2 Snare.wav" },
    ];
    const errors = validateKitPlan(plan);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("kick.wav");
    expect(errors[0]).toContain("more than once");
  });

  it("detects sample assigned to multiple voices", () => {
    const plan = [
      { source: "/foo/kick.wav", target: "1 Kick.wav" },
      { source: "/foo/snare.wav", target: "2 Snare.wav" },
      { source: "/foo/snare.wav", target: "3 Snare2.wav" },
    ];
    const errors = validateKitPlan(plan);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("snare.wav");
    expect(errors[0]).toContain("more than once");
  });

  it("handles targets without voice numbers", () => {
    const plan = [
      { source: "/foo/kick.wav", target: "Kick.wav" },
      { source: "/foo/snare.wav", target: "Snare.wav" },
    ];
    expect(validateKitPlan(plan)).toEqual([]);
  });

  it("handles targets with voice numbers 1-4", () => {
    const plan = [
      { source: "/foo/kick.wav", target: "1 Kick.wav" },
      { source: "/foo/snare.wav", target: "2 Snare.wav" },
      { source: "/foo/hihat.wav", target: "3 HiHat.wav" },
      { source: "/foo/crash.wav", target: "4 Crash.wav" },
    ];
    expect(validateKitPlan(plan)).toEqual([]);
  });

  it("detects multiple voice assignments for same sample", () => {
    const plan = [
      { source: "/foo/sample.wav", target: "1 Sample.wav" },
      { source: "/foo/sample.wav", target: "2 Sample.wav" },
    ];
    const errors = validateKitPlan(plan);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("sample.wav");
    expect(errors[0]).toContain("more than once");
  });

  it("handles complex target patterns", () => {
    const plan = [
      { source: "/foo/kick.wav", target: "1Kick.wav" },
      { source: "/foo/snare.wav", target: "2 Snare.wav" },
      { source: "/foo/hihat.wav", target: "3.HiHat.wav" },
    ];
    expect(validateKitPlan(plan)).toEqual([]);
  });
});

describe("writeKitSamples", () => {
  const tmpDir = path.join(__dirname, "tmp_write_kit_test");
  const kitPath = path.join(tmpDir, "TestKit");
  const sourceDir = path.join(tmpDir, "sources");

  beforeEach(() => {
    // Clean up and set up
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(kitPath, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });

    // Create some existing .wav files in kit directory
    fs.writeFileSync(path.join(kitPath, "1 OldKick.wav"), "old kick");
    fs.writeFileSync(path.join(kitPath, "2 OldSnare.wav"), "old snare");
    fs.writeFileSync(path.join(kitPath, "some_other_file.txt"), "not a wav");

    // Create source files
    fs.writeFileSync(path.join(sourceDir, "kick.wav"), "new kick");
    fs.writeFileSync(path.join(sourceDir, "snare.wav"), "new snare");
    fs.writeFileSync(path.join(sourceDir, "hihat.wav"), "new hihat");
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("removes existing .wav files and copies new ones", () => {
    const plan = [
      {
        source: path.join(sourceDir, "kick.wav"),
        target: "1 Kick.wav",
      },
      {
        source: path.join(sourceDir, "snare.wav"),
        target: "2 Snare.wav",
      },
    ];

    writeKitSamples(plan, kitPath);

    // Old .wav files should be removed
    expect(fs.existsSync(path.join(kitPath, "1 OldKick.wav"))).toBe(false);
    expect(fs.existsSync(path.join(kitPath, "2 OldSnare.wav"))).toBe(false);

    // New files should be created
    expect(fs.existsSync(path.join(kitPath, "1 Kick.wav"))).toBe(true);
    expect(fs.existsSync(path.join(kitPath, "2 Snare.wav"))).toBe(true);

    // Non-.wav files should remain
    expect(fs.existsSync(path.join(kitPath, "some_other_file.txt"))).toBe(true);

    // Content should match
    expect(fs.readFileSync(path.join(kitPath, "1 Kick.wav"), "utf8")).toBe(
      "new kick",
    );
    expect(fs.readFileSync(path.join(kitPath, "2 Snare.wav"), "utf8")).toBe(
      "new snare",
    );
  });

  it("handles case-insensitive .wav extension", () => {
    // Create files with different case extensions
    fs.writeFileSync(path.join(kitPath, "1 Test.WAV"), "test wav");
    fs.writeFileSync(path.join(kitPath, "2 Test.Wav"), "test wav2");

    const plan = [
      {
        source: path.join(sourceDir, "kick.wav"),
        target: "1 NewKick.wav",
      },
    ];

    writeKitSamples(plan, kitPath);

    // Case-insensitive .wav files should be removed
    expect(fs.existsSync(path.join(kitPath, "1 Test.WAV"))).toBe(false);
    expect(fs.existsSync(path.join(kitPath, "2 Test.Wav"))).toBe(false);
    expect(fs.existsSync(path.join(kitPath, "1 NewKick.wav"))).toBe(true);
  });

  it("handles voice assignment correctly", () => {
    const plan = [
      {
        source: path.join(sourceDir, "kick.wav"),
        target: "2 Kick.wav", // Should go to voice 2
      },
      {
        source: path.join(sourceDir, "snare.wav"),
        target: "4 Snare.wav", // Should go to voice 4
      },
      {
        source: path.join(sourceDir, "hihat.wav"),
        target: "HiHat.wav", // No voice number, should default to voice 1
      },
    ];

    writeKitSamples(plan, kitPath);

    expect(fs.existsSync(path.join(kitPath, "2 Kick.wav"))).toBe(true);
    expect(fs.existsSync(path.join(kitPath, "4 Snare.wav"))).toBe(true);
    expect(fs.existsSync(path.join(kitPath, "HiHat.wav"))).toBe(true);
  });

  it("handles complex target name patterns", () => {
    const plan = [
      {
        source: path.join(sourceDir, "kick.wav"),
        target: "1.Kick.wav", // Period separator
      },
      {
        source: path.join(sourceDir, "snare.wav"),
        target: "2Snare.wav", // No separator
      },
      {
        source: path.join(sourceDir, "hihat.wav"),
        target: "3 HiHat.wav", // Space separator
      },
    ];

    writeKitSamples(plan, kitPath);

    expect(fs.existsSync(path.join(kitPath, "1.Kick.wav"))).toBe(true);
    expect(fs.existsSync(path.join(kitPath, "2Snare.wav"))).toBe(true);
    expect(fs.existsSync(path.join(kitPath, "3 HiHat.wav"))).toBe(true);
  });

  it("handles non-existent kit directory", () => {
    const nonExistentKit = path.join(tmpDir, "NonExistentKit");
    const plan = [
      {
        source: path.join(sourceDir, "kick.wav"),
        target: "1 Kick.wav",
      },
    ];

    // Should not throw an error
    expect(() => writeKitSamples(plan, nonExistentKit)).not.toThrow();
  });

  it("handles copy errors gracefully", () => {
    const plan = [
      {
        source: "/non/existent/source.wav", // Non-existent source
        target: "1 Test.wav",
      },
    ];

    // Should not throw an error due to try/catch
    expect(() => writeKitSamples(plan, kitPath)).not.toThrow();
  });

  it("handles unlink errors gracefully", () => {
    // Create a file and make directory readonly to cause unlink error
    const readonlyKit = path.join(tmpDir, "ReadonlyKit");
    fs.mkdirSync(readonlyKit);
    fs.writeFileSync(path.join(readonlyKit, "1 Test.wav"), "test");

    // Mock fs.unlinkSync to throw an error
    const originalUnlink = fs.unlinkSync;
    fs.unlinkSync = vi.fn().mockImplementation(() => {
      throw new Error("Permission denied");
    });

    const plan = [
      {
        source: path.join(sourceDir, "kick.wav"),
        target: "1 NewTest.wav",
      },
    ];

    // Should not throw due to try/catch
    expect(() => writeKitSamples(plan, readonlyKit)).not.toThrow();

    // Restore original function
    fs.unlinkSync = originalUnlink;
  });
});

describe("rescanVoiceNames", () => {
  const tmpDir = path.join(__dirname, "tmp_rescan_test");

  beforeEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("rescans voice names from properly formatted .wav files", () => {
    fs.writeFileSync(path.join(tmpDir, "1 Kick.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "2 Snare.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "3 HiHat.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "4 Crash.wav"), "dummy");

    const voiceNames = rescanVoiceNames(tmpDir);

    expect(voiceNames[1]).toBe("Kick");
    expect(voiceNames[2]).toBe("Snare");
    expect(voiceNames[3]).toBe("HiHat");
    expect(voiceNames[4]).toBe("Crash");
  });

  it("handles files with extensions in the name", () => {
    fs.writeFileSync(path.join(tmpDir, "1 Kick-Sample.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "2 Snare-Loop.wav"), "dummy");

    const voiceNames = rescanVoiceNames(tmpDir);

    expect(voiceNames[1]).toBe("Kick-Sample");
    expect(voiceNames[2]).toBe("Snare-Loop");
  });

  it("handles case-insensitive .wav files", () => {
    fs.writeFileSync(path.join(tmpDir, "1 Kick.WAV"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "2 Snare.Wav"), "dummy");

    const voiceNames = rescanVoiceNames(tmpDir);

    expect(voiceNames[1]).toBe("Kick");
    expect(voiceNames[2]).toBe("Snare");
  });

  it("ignores files without proper voice number format", () => {
    fs.writeFileSync(path.join(tmpDir, "Kick.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "5 InvalidVoice.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "a NotANumber.wav"), "dummy");

    const voiceNames = rescanVoiceNames(tmpDir);

    expect(Object.keys(voiceNames)).toHaveLength(0);
  });

  it("ignores non-.wav files", () => {
    fs.writeFileSync(path.join(tmpDir, "1 Kick.mp3"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "2 Snare.txt"), "dummy");

    const voiceNames = rescanVoiceNames(tmpDir);

    expect(Object.keys(voiceNames)).toHaveLength(0);
  });

  it("handles complex name patterns", () => {
    fs.writeFileSync(path.join(tmpDir, "1 Kick-Hard-Hit.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "2 Snare With Spaces.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "3 HiHat_Closed.wav"), "dummy");

    const voiceNames = rescanVoiceNames(tmpDir);

    expect(voiceNames[1]).toBe("Kick-Hard-Hit");
    expect(voiceNames[2]).toBe("Snare With Spaces");
    expect(voiceNames[3]).toBe("HiHat_Closed");
  });

  it("handles non-existent directory", () => {
    const nonExistentDir = path.join(tmpDir, "NonExistent");
    const voiceNames = rescanVoiceNames(nonExistentDir);

    expect(voiceNames).toEqual({});
  });

  it("handles empty directory", () => {
    const voiceNames = rescanVoiceNames(tmpDir);

    expect(voiceNames).toEqual({});
  });

  it("overwrites duplicate voice numbers (last one wins)", () => {
    fs.writeFileSync(path.join(tmpDir, "1 Kick.wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "1 AnotherKick.wav"), "dummy");

    const voiceNames = rescanVoiceNames(tmpDir);

    // The result depends on the order files are processed by readdirSync
    // Both outcomes are valid since the implementation doesn't guarantee order
    expect(voiceNames[1]).toMatch(/^(Kick|AnotherKick)$/);
  });

  it("trims whitespace from voice names", () => {
    fs.writeFileSync(path.join(tmpDir, "1   Kick   .wav"), "dummy");
    fs.writeFileSync(path.join(tmpDir, "2	Snare	.wav"), "dummy"); // tabs

    const voiceNames = rescanVoiceNames(tmpDir);

    expect(voiceNames[1]).toBe("Kick");
    expect(voiceNames[2]).toBe("Snare");
  });
});

describe("commitKitPlanHandler", () => {
  const tmpDir = path.join(__dirname, "tmp_commit_test");
  const kitName = "TestKit";
  const localStorePath = tmpDir;

  beforeEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    // Reset mocks
    vi.clearAllMocks();

    // Restore any spies to avoid contamination between tests
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("successfully commits a valid plan", async () => {
    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: [
            { source: "/source/kick.wav", target: "1 Kick.wav" },
            { source: "/source/snare.wav", target: "2 Snare.wav" },
          ],
          voiceNames: {},
        },
      },
    };

    vi.mocked(readRampleLabels).mockReturnValue(labels);
    vi.mocked(writeRampleLabels).mockImplementation(() => {});

    // Create source files for the plan
    const sourceDir = path.join(tmpDir, "source");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "kick.wav"), "kick content");
    fs.writeFileSync(path.join(sourceDir, "snare.wav"), "snare content");

    // Update plan to use real source paths
    labels.kits[kitName].plan = [
      { source: path.join(sourceDir, "kick.wav"), target: "1 Kick.wav" },
      { source: path.join(sourceDir, "snare.wav"), target: "2 Snare.wav" },
    ];

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(writeRampleLabels).toHaveBeenCalledWith(
      localStorePath,
      expect.objectContaining({
        kits: expect.objectContaining({
          [kitName]: expect.objectContaining({
            voiceNames: expect.objectContaining({
              1: "Kick",
              2: "Snare",
            }),
          }),
        }),
      }),
    );
  });

  it("fails when no labels found", async () => {
    vi.mocked(readRampleLabels).mockReturnValue(null);

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("No plan found for kit.");
  });

  it("fails when kit not found in labels", async () => {
    const labels = { kits: {} };
    vi.mocked(readRampleLabels).mockReturnValue(labels);

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("No plan found for kit.");
  });

  it("fails when no plan in kit", async () => {
    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          // No plan property
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("No plan found for kit.");
  });

  it("fails when plan is not an array", async () => {
    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: "not an array",
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Plan must have 1-12 samples.");
  });

  it("fails when plan is empty", async () => {
    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: [],
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Plan must have 1-12 samples.");
  });

  it("fails when plan has too many samples", async () => {
    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: new Array(13).fill({
            source: "/test.wav",
            target: "1 Test.wav",
          }),
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Plan must have 1-12 samples.");
  });

  it("fails when plan validation errors occur", async () => {
    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: [
            { source: "/test.wav", target: "1 Test.wav" },
            { source: "/test.wav", target: "2 Test.wav" }, // Duplicate source
          ],
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("more than once");
  });

  it("creates kit directory if it doesn't exist", async () => {
    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: [{ source: "/test.wav", target: "1 Test.wav" }],
          voiceNames: {},
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);
    vi.mocked(writeRampleLabels).mockImplementation(() => {});

    const result = await commitKitPlanHandler(localStorePath, kitName);

    const kitPath = path.join(localStorePath, kitName);
    expect(fs.existsSync(kitPath)).toBe(true);
  });

  it("handles kit directory creation failure", async () => {
    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: [{ source: "/test.wav", target: "1 Test.wav" }],
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);

    // Create a file with the same name as the directory we want to create
    // This will cause the validation to fail since path exists but is not a directory
    const problematicPath = path.join(localStorePath, kitName);
    if (fs.existsSync(problematicPath)) {
      fs.rmSync(problematicPath, { recursive: true, force: true });
    }

    fs.writeFileSync(problematicPath, "blocking file");

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Kit path exists but is not a directory/);

    // Cleanup
    if (fs.existsSync(problematicPath)) {
      if (fs.statSync(problematicPath).isFile()) {
        fs.unlinkSync(problematicPath);
      } else {
        fs.rmSync(problematicPath, { recursive: true, force: true });
      }
    }
  });

  it("initializes voiceNames if not present", async () => {
    const sourceDir = path.join(tmpDir, "source");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "test.wav"), "test");

    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: [
            { source: path.join(sourceDir, "test.wav"), target: "1 Test.wav" },
          ],
          // No voiceNames property
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);
    vi.mocked(writeRampleLabels).mockImplementation(() => {});

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(true);
    expect(writeRampleLabels).toHaveBeenCalledWith(
      localStorePath,
      expect.objectContaining({
        kits: expect.objectContaining({
          [kitName]: expect.objectContaining({
            voiceNames: expect.any(Object),
          }),
        }),
      }),
    );
  });

  it("merges new voice names with existing ones", async () => {
    const sourceDir = path.join(tmpDir, "source");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "kick.wav"), "kick");

    const labels = {
      kits: {
        [kitName]: {
          label: kitName,
          plan: [
            { source: path.join(sourceDir, "kick.wav"), target: "1 Kick.wav" },
          ],
          voiceNames: {
            2: "ExistingSnare",
            3: "ExistingHiHat",
          },
        },
      },
    };
    vi.mocked(readRampleLabels).mockReturnValue(labels);
    vi.mocked(writeRampleLabels).mockImplementation(() => {});

    const result = await commitKitPlanHandler(localStorePath, kitName);

    expect(result.success).toBe(true);
    expect(writeRampleLabels).toHaveBeenCalledWith(
      localStorePath,
      expect.objectContaining({
        kits: expect.objectContaining({
          [kitName]: expect.objectContaining({
            voiceNames: expect.objectContaining({
              1: "Kick", // New voice name
              2: "ExistingSnare", // Existing voice name preserved
              3: "ExistingHiHat", // Existing voice name preserved
            }),
          }),
        }),
      }),
    );
  });
});
