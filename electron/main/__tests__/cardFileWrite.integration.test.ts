import { MAX_CARD_FILE_NAME_LENGTH } from "@romper/shared/rampleCardLayout.js";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTempStore,
  removeTempStore,
} from "../../../tests/integration/support/tempStore.js";
import { cardTempPath, writeCardFileAtomically } from "../cardFileWrite.js";

// #882: a sample reaches the card under its own name only once it's
// complete; until then the card keeps the copy it had.

const errno = (code: string) =>
  Object.assign(new Error(`${code}: rename`), { code });

describe("[UC-34] [Q-04] writeCardFileAtomically", () => {
  let kit: string;
  let sample: string;

  beforeEach(() => {
    kit = createTempStore("romper-card-write-");
    sample = path.join(kit, "1-01 KICK.wav");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    removeTempStore(kit);
  });

  it("writes to a temporary name, then puts the file under its own name", async () => {
    let written = "";
    await writeCardFileAtomically(sample, async (tempPath) => {
      written = tempPath;
      expect(path.dirname(tempPath)).toBe(kit);
      await fs.promises.writeFile(tempPath, "new");
      expect(fs.existsSync(sample)).toBe(false);
    });

    expect(fs.readFileSync(sample, "utf8")).toBe("new");
    expect(fs.existsSync(written)).toBe(false);
    expect(fs.readdirSync(kit)).toEqual(["1-01 KICK.wav"]);
  });

  it("replaces the card's earlier copy", async () => {
    fs.writeFileSync(sample, "old");
    await writeCardFileAtomically(sample, (tempPath) =>
      fs.promises.writeFile(tempPath, "new"),
    );
    expect(fs.readFileSync(sample, "utf8")).toBe("new");
    expect(fs.readdirSync(kit)).toEqual(["1-01 KICK.wav"]);
  });

  it("keeps the earlier copy and removes the cut-off file when the write fails", async () => {
    fs.writeFileSync(sample, "old");
    await expect(
      writeCardFileAtomically(sample, async (tempPath) => {
        await fs.promises.writeFile(tempPath, "ha");
        throw errno("EIO");
      }),
    ).rejects.toThrow("EIO");
    expect(fs.readFileSync(sample, "utf8")).toBe("old");
    expect(fs.readdirSync(kit)).toEqual(["1-01 KICK.wav"]);
  });

  it("moves the old copy aside when Windows won't rename over it, and removes it after", async () => {
    fs.writeFileSync(sample, "old");
    const rename = fs.promises.rename.bind(fs.promises);
    const spy = vi
      .spyOn(fs.promises, "rename")
      .mockImplementationOnce(() => Promise.reject(errno("EPERM")))
      .mockImplementation(rename);

    await writeCardFileAtomically(sample, (tempPath) =>
      fs.promises.writeFile(tempPath, "new"),
    );

    expect(spy).toHaveBeenCalledTimes(3);
    expect(fs.readFileSync(sample, "utf8")).toBe("new");
    expect(fs.readdirSync(kit)).toEqual(["1-01 KICK.wav"]);
  });

  it("puts the old copy back when the new one can't take its name", async () => {
    fs.writeFileSync(sample, "old");
    const rename = fs.promises.rename.bind(fs.promises);
    vi.spyOn(fs.promises, "rename")
      .mockImplementationOnce(() => Promise.reject(errno("EPERM")))
      .mockImplementationOnce(rename)
      .mockImplementationOnce(() => Promise.reject(errno("EIO")))
      .mockImplementation(rename);

    await expect(
      writeCardFileAtomically(sample, (tempPath) =>
        fs.promises.writeFile(tempPath, "new"),
      ),
    ).rejects.toThrow("EIO");

    expect(fs.readFileSync(sample, "utf8")).toBe("old");
    expect(fs.readdirSync(kit)).toEqual(["1-01 KICK.wav"]);
  });

  it("fails without moving anything when a refused rename has no file to replace", async () => {
    vi.spyOn(fs.promises, "rename").mockRejectedValue(errno("EPERM"));
    await expect(
      writeCardFileAtomically(sample, (tempPath) =>
        fs.promises.writeFile(tempPath, "new"),
      ),
    ).rejects.toThrow("EPERM");
    expect(fs.readdirSync(kit)).toEqual([]);
  });

  it.runIf(process.platform === "darwin")(
    "removes the ._ file macOS makes beside the temporary file",
    async () => {
      await writeCardFileAtomically(sample, async (tempPath) => {
        await fs.promises.writeFile(tempPath, "new");
        // What macOS writes beside a file on a FAT or exFAT card
        await fs.promises.writeFile(
          path.join(kit, `._${path.basename(tempPath)}`),
          "attributes",
        );
      });
      expect(fs.readdirSync(kit)).toEqual(["1-01 KICK.wav"]);
    },
  );

  it("names the temporary file so it can't be a sample", () => {
    const name = path.basename(cardTempPath(sample));
    expect(name).toMatch(/^romper-[0-9a-f]{8}\.tmp$/);
    expect(name.length).toBeLessThanOrEqual(MAX_CARD_FILE_NAME_LENGTH);
    expect(cardTempPath(sample)).not.toBe(cardTempPath(sample));
  });
});
