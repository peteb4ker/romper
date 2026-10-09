import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { removeCardEntries } from "../../electron/main/services/sdCardSafety.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #653: removing the kits the store no longer has from the card blocked
// the main process (a synchronous recursive delete per kit), so on a slow
// card the window froze until every removal finished. Removal is now
// asynchronous and yields between entries.

// A kit folder per voice-layer file is enough to show the removal yields
// between entries. Kept small, and built in parallel, so setup is quick on
// Windows runners, where creating files is slow (#673).
const KITS = 12;
const FILES_PER_KIT = 4;

describe("[UC-34] [Q-01] removing old kits from the card (#653)", () => {
  let work: string;
  let card: string;
  let kits: string[];

  beforeEach(async () => {
    work = createTempStore("romper-card-removal-");
    card = path.join(work, "card");
    kits = Array.from(
      { length: KITS },
      (_, k) => `${String.fromCodePoint(65 + k)}10`,
    );
    await Promise.all(
      kits.map(async (kit) => {
        await fs.promises.mkdir(path.join(card, kit), { recursive: true });
        await Promise.all(
          Array.from({ length: FILES_PER_KIT }, (_, f) =>
            fs.promises.writeFile(
              path.join(card, kit, `${f + 1}-01 sample.wav`),
              "",
            ),
          ),
        );
      }),
    );
  });

  afterEach(() => {
    removeTempStore(work);
  });

  it("lets other work run while it removes a tree of kit folders", async () => {
    // Count event-loop turns during the removal: a removal that held the
    // main thread would let none through until it finished
    let turns = 0;
    let removing = true;
    const tick = () => {
      if (!removing) return;
      turns++;
      setImmediate(tick);
    };
    setImmediate(tick);
    let progressEvents = 0;

    const { removed } = await removeCardEntries(card, kits, {
      onRemoved: () => progressEvents++,
    });
    removing = false;

    expect(removed).toBe(KITS);
    expect(progressEvents).toBe(KITS);
    expect(fs.readdirSync(card)).toEqual([]);
    // At least one turn per kit removed
    expect(turns).toBeGreaterThanOrEqual(KITS);
  });
});
