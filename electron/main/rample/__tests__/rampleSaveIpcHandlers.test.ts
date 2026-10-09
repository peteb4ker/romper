import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IpcHandler } from "../../ipcHandle";

vi.mock("electron", () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock("../rampleKitSaveView.js", () => ({
  readKitRampleSave: vi.fn(() =>
    Promise.resolve({
      data: { kitName: "L1", status: "noCopy" },
      success: true,
    }),
  ),
}));

import { ipcMain } from "electron";

import { readKitRampleSave } from "../rampleKitSaveView.js";
import { registerRampleSaveIpcHandlers } from "../rampleSaveIpcHandlers";

function registeredHandler(): IpcHandler<"get-kit-rample-save"> {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([channel]) => channel === "get-kit-rample-save");
  if (!call) throw new Error("get-kit-rample-save isn't registered");
  return call[1] as IpcHandler<"get-kit-rample-save">;
}

const event = {} as Parameters<IpcHandler<"get-kit-rample-save">>[0];

describe("[UC-08] [Q-08] the get-kit-rample-save channel (#800)", () => {
  const savedEnv = process.env.ROMPER_LOCAL_PATH;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ROMPER_LOCAL_PATH;
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedEnv;
  });

  it("reads the kit's file from the configured store", async () => {
    registerRampleSaveIpcHandlers({ localStorePath: "/store" });

    const result = await registeredHandler()(event, "L1");

    expect(readKitRampleSave).toHaveBeenCalledWith("/store", "L1");
    expect(result).toEqual({
      data: { kitName: "L1", status: "noCopy" },
      success: true,
    });
  });

  it("fails without a store, and reads nothing", async () => {
    registerRampleSaveIpcHandlers({});
    const result = await registeredHandler()(event, "L1");
    expect(result.success).toBe(false);
    expect(readKitRampleSave).not.toHaveBeenCalled();
  });

  it("[Q-03] refuses a kit name that isn't a string", async () => {
    registerRampleSaveIpcHandlers({ localStorePath: "/store" });
    const handler = registeredHandler() as (
      e: typeof event,
      kitName: unknown,
    ) => ReturnType<IpcHandler<"get-kit-rample-save">>;
    const result = await handler(event, { path: "../" });
    expect(result.success).toBe(false);
    expect(readKitRampleSave).not.toHaveBeenCalled();
  });
});
