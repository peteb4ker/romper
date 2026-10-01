import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { compareCard, type ExpectedCardFile } from "../card";
import { ValidationReport } from "../report";
import { encodeTestWav, sine } from "../wav";

// The comparison must catch what it's there to catch, or a passing run means
// nothing.

let dir: string;
let card: string;
let source: string;
let stereoSource: string;

const pcm16 = { bitDepth: 16, encoding: "pcm", sampleRate: 44100 } as const;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-card-test-"));
  card = path.join(dir, "card");
  await fs.mkdir(path.join(card, "A0"), { recursive: true });
  source = path.join(dir, "kick.wav");
  await fs.writeFile(source, encodeTestWav([sine(60, 0.05, 44100)], pcm16));
  stereoSource = path.join(dir, "pad.wav");
  await fs.writeFile(
    stereoSource,
    encodeTestWav([sine(200, 0.05, 44100), sine(300, 0.05, 44100)], pcm16),
  );
});

afterEach(async () => {
  await fs.rm(dir, { force: true, recursive: true });
});

function copyOf(file: string): ExpectedCardFile {
  return {
    gainDb: 0,
    kind: "copy",
    outputChannels: 1,
    reason: "Rample-native",
    source: file,
  };
}

async function run(expected: Map<string, ExpectedCardFile>) {
  const report = new ValidationReport(dir, {});
  await compareCard(report, card, expected, ["_save"]);
  return report;
}

const failed = (report: ValidationReport) =>
  report.checks.filter((c) => c.status === "fail").map((c) => c.name);

describe("compareCard", () => {
  it("passes an exact copy", async () => {
    await fs.copyFile(source, path.join(card, "A0", "1-01 kick.wav"));
    await fs.mkdir(path.join(card, "_save"));
    const report = await run(new Map([["A0/1-01 kick.wav", copyOf(source)]]));
    expect(failed(report)).toEqual([]);
  });

  it("fails when one byte of a copied file differs", async () => {
    const bytes = await fs.readFile(source);
    bytes[bytes.length - 1] ^= 1;
    await fs.writeFile(path.join(card, "A0", "1-01 kick.wav"), bytes);
    await fs.mkdir(path.join(card, "_save"));
    const report = await run(new Map([["A0/1-01 kick.wav", copyOf(source)]]));
    expect(failed(report)).toEqual([
      "1 copied files are byte-identical to their sources",
    ]);
  });

  it("fails on a missing file and on an unexpected one", async () => {
    await fs.writeFile(path.join(card, "A0", "stale.wav"), "x");
    await fs.writeFile(path.join(card, "stray.txt"), "x");
    const report = await run(new Map([["A0/1-01 kick.wav", copyOf(source)]]));
    expect(failed(report)).toEqual([
      "card root holds exactly the kit folders, bank files and _save",
      "every kit folder holds exactly its samples (1 kits)",
    ]);
  });

  it("reports a known bug as known, and flags it once it passes", async () => {
    const expected = new Map<string, ExpectedCardFile>([
      [
        "A0/3-01 pad.wav",
        {
          gainDb: 0,
          kind: "convert",
          knownBug: "RE-29",
          outputChannels: 1,
          reason: "stereo file on a mono voice",
          source: stereoSource,
        },
      ],
    ]);
    await fs.mkdir(path.join(card, "_save"));

    // Today: the stereo file is copied unconverted
    await fs.copyFile(stereoSource, path.join(card, "A0", "3-01 pad.wav"));
    const before = await run(expected);
    expect(before.checks.find((c) => c.ref === "RE-29")?.status).toBe("known");
    expect(before.failures([])).toEqual([]);

    // Once fixed: the card holds the mono mix, and the marker must go
    const mono = encodeTestWav(
      [
        sine(200, 0.05, 44100).map(
          (v, i) => (v + sine(300, 0.05, 44100)[i]) / 2,
        ),
      ],
      pcm16,
    );
    await fs.writeFile(path.join(card, "A0", "3-01 pad.wav"), mono);
    const after = await run(expected);
    expect(after.checks.find((c) => c.ref === "RE-29")?.status).toBe(
      "stale-known",
    );
    expect(after.failures([])).toHaveLength(1);
  });
});
