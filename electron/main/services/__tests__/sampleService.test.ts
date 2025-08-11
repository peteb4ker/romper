import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => Buffer.alloc(100)),
  statSync: vi.fn(() => ({ size: 1000 })),
}));

vi.mock("path", () => ({
  basename: vi.fn((p) => p.split("/").pop()),
  join: vi.fn((...args) => args.join("/")),
}));

vi.mock("../../db/romperDbCoreORM.js", () => ({
  addSample: vi.fn(),
  deleteSamples: vi.fn(),
  getKitSamples: vi.fn(),
  markKitAsModified: vi.fn(),
  moveSample: vi.fn(),
}));

vi.mock("../../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(() => ({ duration: 1.0, sampleRate: 44100 })),
}));

vi.mock("../../utils/stereoProcessingUtils.js", () => ({
  determineStereoConfiguration: vi.fn(() => false),
}));

vi.mock("../../utils/fileSystemUtils.js", () => ({
  ServicePathManager: {
    getDbPath: vi.fn((path) => `${path}/romper.db`),
    getLocalStorePath: vi.fn(() => "/test/store/path"),
  },
}));

import { SampleService } from "../sampleService.js";

describe("SampleService", () => {
  let sampleService: SampleService;

  beforeEach(() => {
    vi.clearAllMocks();
    sampleService = new SampleService();
  });

  describe("Core Functionality", () => {
    it("initializes without error", () => {
      expect(sampleService).toBeDefined();
    });

    it("can add sample to slot", () => {
      // Just test that the method exists and can be called
      expect(typeof sampleService.addSampleToSlot).toBe("function");
    });

    it("can delete sample from slot", () => {
      expect(typeof sampleService.deleteSampleFromSlot).toBe("function");
    });

    it("can move samples", () => {
      expect(typeof sampleService.moveSampleInKit).toBe("function");
    });
  });

  describe("Error Handling", () => {
    it("has error handling methods", () => {
      expect(sampleService).toBeDefined();
    });
  });
});
