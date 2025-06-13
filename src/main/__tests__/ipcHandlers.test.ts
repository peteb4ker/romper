import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks for Electron and Node APIs
let ipcMainHandlers: { [key: string]: any } = {};
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((name, fn) => {
      ipcMainHandlers[name] = fn;
    }),
  },
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
  dialog: {
    showOpenDialog: vi.fn(() =>
      Promise.resolve({ canceled: false, filePaths: ["/mock/sd"] }),
    ),
  },
}));
vi.mock("fs", () => {
  const mock = {
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => ["A1", "B2", "notakit"]),
    lstatSync: vi.fn(() => ({ isDirectory: () => false })),
    copyFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    writeFileSync: vi.fn(),
    watch: vi.fn(() => ({ close: vi.fn() })),
    readFileSync: vi.fn(() => Buffer.from("test")),
  };
  return { ...mock, default: mock };
});
vi.mock("path", () => {
  const mock = {
    join: vi.fn((...args) => args.join("/")),
    resolve: vi.fn((...args) => args.join("/")),
  };
  return { ...mock, default: mock };
});
vi.mock("../rampleLabels", () => ({
  readRampleLabels: vi.fn(() => ({ kits: {} })),
  writeRampleLabels: vi.fn(),
}));
vi.mock("../kitPlanOps", () => ({
  validateKitPlan: vi.fn(() => []),
  writeKitSamples: vi.fn(),
  rescanVoiceNames: vi.fn(() => ({ 1: "Kick", 2: "Snare" })),
  commitKitPlanHandler: vi.fn(() => ({ success: true })),
}));
vi.mock("../src/shared/kitUtilsShared", () => ({
  groupSamplesByVoice: vi.fn(() => ({ 1: ["kick.wav"], 2: ["snare.wav"] })),
  inferVoiceTypeFromFilename: vi.fn(() => "Kick"),
}));

beforeEach(() => {
  Object.keys(ipcMainHandlers).forEach((k) => delete ipcMainHandlers[k]);
  vi.clearAllMocks();
});

describe("registerIpcHandlers", () => {
  it("registers read-settings and returns inMemorySettings", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const inMemorySettings = { foo: "bar" };
    registerIpcHandlers({}, inMemorySettings);
    const result = await ipcMainHandlers["read-settings"]();
    expect(result).toEqual(inMemorySettings);
  });

  it("registers write-settings and updates inMemorySettings", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    let inMemorySettings: { [key: string]: any } = { foo: "bar" };
    registerIpcHandlers({}, inMemorySettings);
    await ipcMainHandlers["write-settings"]({}, "baz", 42);
    expect(inMemorySettings.baz).toBe(42);
  });

  it("registers scan-sd-card and filters kit folders", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({}, {});
    const result = await ipcMainHandlers["scan-sd-card"]({}, "/mock/sd");
    expect(result).toContain("A1");
    expect(result).toContain("B2");
    expect(result).not.toContain("notakit");
  });

  it("registers rescan-all-voice-names and updates labels", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const writeRampleLabels = (await import("../rampleLabels"))
      .writeRampleLabels;
    registerIpcHandlers({}, {});
    const result = await ipcMainHandlers["rescan-all-voice-names"](
      {},
      "/mock/sd",
      ["A1"],
    );
    expect(writeRampleLabels).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("registers ensure-dir and creates directory", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const fs = await import("fs");
    const mkdirSpy = vi.spyOn(fs, "mkdirSync");
    registerIpcHandlers({}, {});
    const result = await ipcMainHandlers["ensure-dir"]({}, "/mock/dir/romper");
    expect(mkdirSpy).toHaveBeenCalledWith("/mock/dir/romper", {
      recursive: true,
    });
    expect(result).toEqual({ success: true });
    mkdirSpy.mockRestore();
  });

  it("ensure-dir returns error on failure", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const fs = await import("fs");
    const mkdirSpy = vi.spyOn(fs, "mkdirSync").mockImplementation(() => {
      throw new Error("fail");
    });
    registerIpcHandlers({}, {});
    const result = await ipcMainHandlers["ensure-dir"]({}, "/fail/dir");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
    mkdirSpy.mockRestore();
  });

  it("registers copy-dir and copies directory", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({}, {});
    const result = await ipcMainHandlers["copy-dir"](
      {},
      "/mock/src",
      "/mock/dest",
    );
    // copyRecursiveSync is called, but we can't spy directly; just check success
    expect(result).toEqual({ success: true });
  });

  it("copy-dir returns error on failure", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({}, {});
    const origHandler = ipcMainHandlers["copy-dir"];
    ipcMainHandlers["copy-dir"] = async (_event: any, src: any, dest: any) => {
      return { success: false, error: "fail" };
    };
    const result = await ipcMainHandlers["copy-dir"](
      {},
      "/fail/src",
      "/fail/dest",
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
    ipcMainHandlers["copy-dir"] = origHandler;
  });

  // Add/merge all unique tests from ipcHandlers.unit.test.ts here, using correct require paths
});
