/**
 * What the card should hold, worked out from the local store's database,
 * and the comparison of a written card against it.
 *
 * File names come from `shared/rampleCardLayout.ts` (the naming spec). The
 * copy-or-convert decision and the audio are checked independently, with
 * the harness's own WAV code (`wav.ts`).
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { ValidationReport } from "./report";

import { cardSampleFileName } from "../../../shared/rampleCardLayout";
import {
  decodeWav,
  isRampleNative,
  maxSampleDifference,
  readPcm16,
  readWavInfo,
  referenceConversion,
} from "./wav";

export interface ExpectedCardFile {
  gainDb: number;
  kind: "convert" | "copy";
  /** Set when the expectation depends on a bug being fixed */
  knownBug?: string;
  outputChannels: 1 | 2;
  reason: string;
  source: string;
}

export interface StoreSample {
  filename: string;
  gain_db: number;
  kit_name: string;
  slot_number: number;
  source_path: string;
  voice_number: number;
}

export interface StoreSnapshot {
  banks: { artist: null | string; letter: string }[];
  kits: string[];
  samples: StoreSample[];
  /** `${kit}:${voice}` → stereo_mode */
  stereoVoices: Set<string>;
}

/**
 * Compare the card with what it should hold. `rootEntries` lists everything
 * else allowed at the card root (bank files, `_save`).
 */
export async function compareCard(
  report: ValidationReport,
  cardDir: string,
  expected: Map<string, ExpectedCardFile>,
  rootEntries: string[],
): Promise<{ converted: number; copied: number }> {
  await checkListings(report, cardDir, expected, rootEntries);
  return checkContents(report, cardDir, expected);
}

/** Card path (kit/file) → what should be there, for the given kits */
export function expectedCardFiles(
  store: StoreSnapshot,
  kits?: Set<string>,
): Map<string, ExpectedCardFile> {
  const expected = new Map<string, ExpectedCardFile>();
  for (const s of store.samples) {
    if (kits && !kits.has(s.kit_name)) continue;
    const cardPath = `${s.kit_name}/${cardSampleFileName(s.voice_number, s.slot_number, s.filename)}`;
    const info = readWavInfo(readFileSync(s.source_path));
    const stereoVoice = store.stereoVoices.has(
      `${s.kit_name}:${s.voice_number}`,
    );
    const forceMono = info.channels > 1 && !stereoVoice;
    const outputChannels: 1 | 2 = forceMono || info.channels === 1 ? 1 : 2;
    const reasons: string[] = [];
    if (!isRampleNative(info)) {
      reasons.push(
        `${info.bitDepth}-bit ${info.encoding} ${info.sampleRate} Hz ${info.channels} ch`,
      );
    }
    if (s.gain_db !== 0) reasons.push(`gain ${s.gain_db} dB`);
    if (forceMono) reasons.push("stereo file on a mono voice");
    expected.set(cardPath, {
      gainDb: s.gain_db,
      kind: reasons.length === 0 ? "copy" : "convert",
      // Mono conversion never runs today (RE-29)
      knownBug: forceMono ? "RE-29" : undefined,
      outputChannels,
      reason: reasons.join(", ") || "Rample-native",
      source: s.source_path,
    });
  }
  return expected;
}

export function listDiff(actual: string[], expected: string[]): string {
  const a = new Set(actual);
  const e = new Set(expected);
  const extra = actual.filter((x) => !e.has(x));
  const missing = expected.filter((x) => !a.has(x));
  const parts: string[] = [];
  if (extra.length) parts.push(`extra: ${extra.slice(0, 10).join(", ")}`);
  if (missing.length) parts.push(`missing: ${missing.slice(0, 10).join(", ")}`);
  return parts.join("; ");
}

export function readStore(storePath: string): StoreSnapshot {
  const db = new Database(path.join(storePath, ".romperdb", "romper.sqlite"), {
    fileMustExist: true,
    readonly: true,
  });
  try {
    const kits = (
      db.prepare("SELECT name FROM kits ORDER BY name").all() as {
        name: string;
      }[]
    ).map((k) => k.name);
    const samples = db
      .prepare(
        `SELECT kit_name, voice_number, slot_number, filename, source_path, gain_db
         FROM samples ORDER BY kit_name, voice_number, slot_number`,
      )
      .all() as StoreSample[];
    const stereoVoices = new Set(
      (
        db
          .prepare(
            "SELECT kit_name, voice_number FROM voices WHERE stereo_mode = 1",
          )
          .all() as { kit_name: string; voice_number: number }[]
      ).map((v) => `${v.kit_name}:${v.voice_number}`),
    );
    const banks = db
      .prepare("SELECT letter, artist FROM banks ORDER BY letter")
      .all() as StoreSnapshot["banks"];
    return { banks, kits, samples, stereoVoices };
  } finally {
    db.close();
  }
}

export function sameList(a: string[], b: string[]): boolean {
  const x = a.slice().sort();
  const y = b.slice().sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

async function checkContents(
  report: ValidationReport,
  cardDir: string,
  expected: Map<string, ExpectedCardFile>,
): Promise<{ converted: number; copied: number }> {
  const problems = { convert: [] as string[], copy: [] as string[] };
  const counts = { convert: 0, copy: 0 };
  const known = new Map<string, string[]>();
  for (const [cardPath, exp] of expected) {
    const card = await fs
      .readFile(path.join(cardDir, cardPath))
      .catch(() => null);
    if (!card) continue; // reported by the listing check
    const problem = fileProblem(await fs.readFile(exp.source), card, exp);
    if (exp.knownBug) {
      // Reported as one check per bug below; a pass means the bug looks fixed
      const list = known.get(exp.knownBug) ?? [];
      if (problem) list.push(`${cardPath}: ${problem}`);
      known.set(exp.knownBug, list);
      if (!problem) {
        report.check(`${cardPath} (${exp.reason})`, true, {
          knownBug: exp.knownBug,
        });
      }
      continue;
    }
    counts[exp.kind]++;
    if (problem) problems[exp.kind].push(`${cardPath}: ${problem}`);
  }
  report.check(
    `${counts.copy} copied files are byte-identical to their sources`,
    problems.copy.length === 0,
    { details: summarise(problems.copy) },
  );
  report.check(
    `${counts.convert} converted files match the reference conversion (±1 step)`,
    problems.convert.length === 0,
    { details: summarise(problems.convert) },
  );
  for (const [ref, list] of known) {
    if (list.length > 0) {
      report.check("stereo files on mono voices are converted to mono", false, {
        details: summarise(list),
        knownBug: ref,
      });
    }
  }
  return { converted: counts.convert, copied: counts.copy };
}

function checkConverted(
  source: Buffer,
  card: Buffer,
  exp: ExpectedCardFile,
): null | string {
  let info;
  try {
    info = readWavInfo(card);
  } catch (error) {
    return `unreadable: ${error instanceof Error ? error.message : error}`;
  }
  const format = `${info.bitDepth}-bit ${info.encoding} ${info.sampleRate} Hz ${info.channels} ch`;
  const wanted = `16-bit pcm 44100 Hz ${exp.outputChannels} ch`;
  if (format !== wanted) return `is ${format}, expected ${wanted}`;
  const reference = referenceConversion(decodeWav(source), {
    gainDb: exp.gainDb,
    outputChannels: exp.outputChannels,
  });
  const diff = maxSampleDifference(readPcm16(card), reference);
  if (diff === Infinity) return "length differs from the reference";
  return diff > 1 ? `differs from the reference by up to ${diff} steps` : null;
}

async function checkListings(
  report: ValidationReport,
  cardDir: string,
  expected: Map<string, ExpectedCardFile>,
  rootEntries: string[],
): Promise<void> {
  const byKit = new Map<string, string[]>();
  for (const p of expected.keys()) {
    const [kit, file] = p.split("/");
    byKit.set(kit, [...(byKit.get(kit) ?? []), file]);
  }

  const root = await fs.readdir(cardDir);
  const expectedRoot = [...byKit.keys(), ...rootEntries];
  report.check(
    "card root holds exactly the kit folders, bank files and _save",
    sameList(root, expectedRoot),
    { details: listDiff(root, expectedRoot) },
  );

  const problems: string[] = [];
  for (const [kit, files] of byKit) {
    const actual = await fs.readdir(path.join(cardDir, kit)).catch(() => []);
    if (!sameList(actual, files)) {
      problems.push(`${kit}: ${listDiff(actual, files)}`);
    }
  }
  report.check(
    `every kit folder holds exactly its samples (${byKit.size} kits)`,
    problems.length === 0,
    { details: problems.slice(0, 10).join("; ") },
  );
}

function fileProblem(
  source: Buffer,
  card: Buffer,
  exp: ExpectedCardFile,
): null | string {
  if (exp.kind === "convert") return checkConverted(source, card, exp);
  return source.equals(card)
    ? null
    : `differs from ${exp.source} (${card.length} vs ${source.length} bytes)`;
}

function summarise(problems: string[]): string {
  if (problems.length === 0) return "";
  const head = problems.slice(0, 5).join("; ");
  return problems.length > 5
    ? `${head}; and ${problems.length - 5} more`
    : head;
}
