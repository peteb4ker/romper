import { cardKitFolders, isKitName } from "@romper/shared/rampleCardLayout.js";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { getKit } from "../../electron/main/db/romperDbCoreORM.js";
import { archiveService } from "../../electron/main/services/archiveService.js";
import { LocalStoreSetupService } from "../../electron/main/services/localStoreSetupService.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #573: setup and the write named kits by different rules. A lowercase card
// folder such as `a5` wasn't a kit to setup, so it wasn't imported, but the
// write's case-insensitive rule counted it as kit A5's folder and, with no
// kit A5 in the store, deleted it. Both now use the card layout's rule: setup
// imports `a5` as kit A5, and a folder that isn't a kit by that rule, such
// as `Ä1`, is left alone by both.

function writeWav(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    encodeTestWav([sine(220, 0.05, 44100)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
}

describe("[Q-04] [UC-01] setup and the write agree on which card folders are kits (#573)", () => {
  let work: string;
  let card: string;
  let store: string;
  let dbDir: string;

  /** Setup from the card, as the wizard runs it: copy, then import */
  async function setUpFromCard() {
    const setup = new LocalStoreSetupService();
    expect(setup.createSetupDatabase(dbDir).success).toBe(true);
    for (const { folder, kitName } of cardKitFolders(fs.readdirSync(card))) {
      expect(
        (
          await archiveService.copyDirectory(
            path.join(card, folder),
            path.join(store, kitName),
          )
        ).success,
      ).toBe(true);
    }
    const imported = fs.readdirSync(store).filter(isKitName);
    for (const kitName of imported) {
      expect(setup.importSetupKit(dbDir, kitName).success).toBe(true);
    }
    return imported.sort((a, b) => a.localeCompare(b));
  }

  /** The files in the card's folder for `kitName`, whatever its case */
  function cardKitFiles(kitName: string): string[] {
    return fs
      .readdirSync(card)
      .filter((name) => name.toUpperCase() === kitName)
      .flatMap((folder) => fs.readdirSync(path.join(card, folder)));
  }

  beforeEach(() => {
    work = createTempStore("card-kit-names-");
    card = path.join(work, "card");
    store = path.join(work, "store");
    dbDir = path.join(store, ".romperdb");
    writeWav(path.join(card, "a5", "1 KICK.wav"));
    writeWav(path.join(card, "B0", "1 SNARE.wav"));
    // Not a kit folder: Ä is a capital, but not a bank letter A to Z
    writeWav(path.join(card, "Ä1", "1 HAT.wav"));
  });

  afterEach(() => {
    removeTempStore(work);
  });

  it("imports a lowercase kit folder as its upper-case kit, and skips a non-kit folder", async () => {
    expect(await setUpFromCard()).toEqual(["A5", "B0"]);

    const kit = getKit(dbDir, "A5").data;
    expect(kit?.bank_letter).toBe("A");
    expect(kit?.samples?.map((s) => s.filename)).toEqual(["1 KICK.wav"]);
    expect(getKit(dbDir, "Ä1").data).toBeFalsy();
  });

  it("the first write keeps the lowercase folder's kit, and leaves the non-kit folder alone", async () => {
    await setUpFromCard();

    const result = await syncService.startKitSync(
      { localStorePath: store },
      { sdCardPath: card },
    );

    expect(result.success).toBe(true);
    // Kit A5 is on the card, in the folder it came from where the card
    // ignores case (FAT32, macOS) or beside it where it doesn't
    expect(cardKitFiles("A5")).toContain("1-01 KICK.wav");
    expect(cardKitFiles("B0")).toContain("1-01 SNARE.wav");
    expect(fs.readdirSync(path.join(card, "Ä1"))).toEqual(["1 HAT.wav"]);
  });
});
