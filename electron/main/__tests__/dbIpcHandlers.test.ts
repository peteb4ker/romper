import { beforeEach, describe, expect, it, vi } from "vitest";

// Use hoisted vi.mock for electron and romperDbCoreORM
vi.mock("electron", () => {
  // Define handleMock at the top level of the factory
  const handleMock = vi.fn();
  return {
    ipcMain: { handle: handleMock },
    __esModule: true,
    handleMock, // Export for test access
  };
});

vi.mock("../db/romperDbCoreORM", () => {
  return {
    createRomperDbFile: vi.fn(),
    addKit: vi.fn(),
    addSample: vi.fn(),
    __esModule: true,
  };
});

import * as electron from "electron";

import * as romperDbCore from "../db/romperDbCoreORM";
import { registerDbIpcHandlers } from "../dbIpcHandlers";

const getHandleMock = () =>
  (electron as any).handleMock || electron.ipcMain.handle;

describe("dbIpcHandlers", () => {
  beforeEach(() => {
    getHandleMock().mockClear();
    (romperDbCore.createRomperDbFile as any).mockClear();
    (romperDbCore.addKit as any).mockClear();
    (romperDbCore.addSample as any).mockClear();
  });

  it("registers all expected handlers", () => {
    registerDbIpcHandlers();
    const handleMock = getHandleMock();
    expect(handleMock).toHaveBeenCalledWith(
      "create-romper-db",
      expect.any(Function),
    );
    expect(handleMock).toHaveBeenCalledWith("insert-kit", expect.any(Function));
    expect(handleMock).toHaveBeenCalledWith(
      "insert-sample",
      expect.any(Function),
    );
  });

  it("handler for create-romper-db calls createRomperDbFile with correct args", async () => {
    registerDbIpcHandlers();
    const handleMock = getHandleMock();
    const handler = handleMock.mock.calls.find(
      ([ch]: any[]) => ch === "create-romper-db",
    )[1];
    (romperDbCore.createRomperDbFile as any).mockResolvedValue("ok");
    const result = await handler({}, "dbDir");
    expect(romperDbCore.createRomperDbFile).toHaveBeenCalledWith("dbDir");
    expect(result).toBe("ok");
  });

  it("handler for insert-kit calls addKit with correct args", async () => {
    registerDbIpcHandlers();
    const handleMock = getHandleMock();
    const handler = handleMock.mock.calls.find(
      ([ch]: any[]) => ch === "insert-kit",
    )[1];
    (romperDbCore.addKit as any).mockResolvedValue("kitResult");
    const kit = { name: "foo", editable: true };
    const result = await handler({}, "dbDir", kit);
    expect(romperDbCore.addKit).toHaveBeenCalledWith("dbDir", kit);
    expect(result).toBe("kitResult");
  });

  it("handler for insert-sample calls addSample with correct args", async () => {
    registerDbIpcHandlers();
    const handleMock = getHandleMock();
    const handler = handleMock.mock.calls.find(
      ([ch]: any[]) => ch === "insert-sample",
    )[1];
    (romperDbCore.addSample as any).mockResolvedValue("sampleResult");
    const sample = {
      kit_id: 1,
      filename: "a.wav",
      slot_number: 2,
      is_stereo: false,
    };
    const result = await handler({}, "dbDir", sample);
    expect(romperDbCore.addSample).toHaveBeenCalledWith("dbDir", sample);
    expect(result).toBe("sampleResult");
  });
});
