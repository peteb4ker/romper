import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { removeCardEntries } from "../../electron/main/services/sdCardSafety.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #653: removing the kits the store no longer has from the card blocked
// the main process (a synchronous recursive delete per kit), so on a slow
// card the window froze until every removal finished. Removal is now
// asynchronous and yields between entries.

const KITS = 40;
const FILES_PER_KIT = 48;

describe("[UC-34] [Q-01] removing old kits from the card (#653)", () => {
  let work: string;
  let card: string;
  let kits: string[];

  beforeEach(() => {
    work = createTempStore("romper-card-removal-");
    card = path.join(work, "card");
    kits = [];
    for (let k = 0; k < KITS; k++) {
      const kit = `${String.fromCodePoint(65 + (k % 26))}${Math.floor(k / 26) + 10}`;
      kits.push(kit);
      fs.mkdirSync(path.join(card, kit), { recursive: true });
      for (let f = 0; f < FILES_PER_KIT; f++) {
        fs.writeFileSync(
          path.join(card, kit, `${(f % 4) + 1}-${f} sample.wav`),
          "x",
        );
      }
    }
  });

  afterEach(() => {
    removeTempStore(work);
  });

  it("lets other work run while it removes a large tree", async () => {
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

    const removed = await removeCardEntries(card, kits, {
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
