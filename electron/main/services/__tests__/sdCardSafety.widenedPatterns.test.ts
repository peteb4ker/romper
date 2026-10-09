import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The kit and bank patterns widened to match every name at the card root,
// as a careless change to either could. The `_save` guard must not depend
// on them (#787).
vi.mock("@romper/shared/rampleCardLayout.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@romper/shared/rampleCardLayout.js")>();
  return {
    ...actual,
    BANK_NAME_FILE_PATTERN: /^/,
    kitNameOfCardFolder: (folderName: string) => folderName.toUpperCase(),
  };
});

import { findStaleCardEntries, removeCardEntries } from "../sdCardSafety";

describe("[Q-04] [UC-34] the _save guard with widened card patterns (#787)", () => {
  let card: string;

  beforeEach(() => {
    card = fs.mkdtempSync(path.join(os.tmpdir(), "romper-save-guard-"));
    fs.mkdirSync(path.join(card, "_save"));
    fs.writeFileSync(path.join(card, "_save", "A0.rpl"), "rample");
    fs.writeFileSync(path.join(card, "_save", "settings.rpl"), "rample");
    fs.mkdirSync(path.join(card, "Drums"));
    fs.writeFileSync(path.join(card, "notes.txt"), "x");
  });

  afterEach(() => {
    fs.rmSync(card, { force: true, recursive: true });
  });

  it("still leaves _save out of the stale entries", async () => {
    const stale = await findStaleCardEntries(card, {
      bankFiles: [],
      kits: new Map(),
    });

    // The widened patterns do take everything else
    expect(stale).toEqual(["Drums", "notes.txt"]);
  });

  it("still keeps _save and its files through a write's removal", async () => {
    const stale = await findStaleCardEntries(card, {
      bankFiles: [],
      kits: new Map(),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const result = await removeCardEntries(card, [...stale, "_save"]);

      expect(result).toEqual({ refused: ["_save"], removed: 2 });
    } finally {
      warn.mockRestore();
    }
    expect(fs.readdirSync(card)).toEqual(["_save"]);
    expect(fs.readdirSync(path.join(card, "_save")).sort()).toEqual([
      "A0.rpl",
      "settings.rpl",
    ]);
  });
});
