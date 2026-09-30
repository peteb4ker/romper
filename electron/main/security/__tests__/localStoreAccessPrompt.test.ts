import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parentWindow = { id: 1 };
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn(() => parentWindow) },
  dialog: { showMessageBox: vi.fn() },
}));

import { BrowserWindow, dialog } from "electron";

import { requestLocalStoreAccess } from "../localStoreAccessPrompt";
import { pathAccess } from "../pathAccess";

describe("requestLocalStoreAccess (RE-03)", () => {
  let tmp: string;
  const sender = { id: 7 } as never;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "romper-store-prompt-"));
    pathAccess.reset();
    vi.mocked(dialog.showMessageBox).mockResolvedValue({
      checkboxChecked: false,
      response: 0,
    });
  });

  afterEach(() => {
    fs.rmSync(tmp, { force: true, recursive: true });
    pathAccess.reset();
    vi.clearAllMocks();
  });

  it("grants a folder already inside a root without prompting", async () => {
    pathAccess.grantRoot(tmp);
    const result = await requestLocalStoreAccess(
      sender,
      path.join(tmp, "romper"),
    );
    expect(result).toEqual({ granted: true });
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it("asks the user, showing the full path, and grants on approval", async () => {
    const target = path.join(tmp, "typed", "romper");
    const result = await requestLocalStoreAccess(sender, target);

    expect(result).toEqual({ granted: true });
    expect(BrowserWindow.fromWebContents).toHaveBeenCalledWith(sender);
    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      parentWindow,
      expect.objectContaining({ cancelId: 1, detail: target }),
    );
    expect(pathAccess.check(path.join(target, "A0"), "write").ok).toBe(true);
  });

  it("grants nothing when the user cancels", async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValue({
      checkboxChecked: false,
      response: 1,
    });
    const target = path.join(tmp, "typed");
    const result = await requestLocalStoreAccess(sender, target);

    expect(result.granted).toBe(false);
    expect(result.error).toContain(target);
    expect(pathAccess.check(target, "write").ok).toBe(false);
  });

  it("prompts without a parent when the sender has no window", async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValueOnce(null);
    await requestLocalStoreAccess(undefined, path.join(tmp, "x"));
    expect(dialog.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ type: "question" }),
    );
  });

  it.each([
    ["the filesystem root", "/"],
    ["the home folder", os.homedir()],
    ["a folder above home", path.dirname(os.homedir())],
  ])("refuses %s without prompting", async (_label, target) => {
    const result = await requestLocalStoreAccess(sender, target);
    expect(result.granted).toBe(false);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it("refuses relative and non-string paths without prompting", async () => {
    expect((await requestLocalStoreAccess(sender, "romper")).granted).toBe(
      false,
    );
    expect((await requestLocalStoreAccess(sender, 42)).granted).toBe(false);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
});
