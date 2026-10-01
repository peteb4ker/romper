/**
 * Checks the setup wizard's factory import against the archive itself:
 * kits, bank names, which files each voice got and in what order, and that
 * every imported file is byte-identical to the archive's copy.
 */
import AdmZip from "adm-zip";
import fs from "node:fs/promises";

import type { StoreSnapshot } from "./card";
import type { ValidationReport } from "./report";

import { listDiff, sameList } from "./card";

const MAX_SLOTS = 12;

export interface FactoryArchive {
  bankFiles: string[];
  /** kit → its WAV file names */
  kits: Map<string, string[]>;
  read(kit: string, file: string): Buffer;
}

export function openFactoryArchive(zipPath: string): FactoryArchive {
  const zip = new AdmZip(zipPath);
  const kits = new Map<string, string[]>();
  const bankFiles: string[] = [];
  const entries = new Map<string, AdmZip.IZipEntry>();
  for (const entry of zip.getEntries()) {
    const name = entry.entryName;
    if (entry.isDirectory || name.startsWith("__MACOSX/")) continue;
    const parts = name.split("/");
    if (parts.length === 1 && name.toLowerCase().endsWith(".rtf")) {
      bankFiles.push(name);
    } else if (parts.length === 2 && parts[1].toLowerCase().endsWith(".wav")) {
      kits.set(parts[0], [...(kits.get(parts[0]) ?? []), parts[1]]);
      entries.set(name, entry);
    }
  }
  return {
    bankFiles: bankFiles.sort(),
    kits,
    read(kit, file) {
      const entry = entries.get(`${kit}/${file}`);
      if (!entry) throw new Error(`${kit}/${file} isn't in the archive`);
      return entry.getData();
    },
  };
}

export async function verifyFactoryImport(
  report: ValidationReport,
  store: StoreSnapshot,
  archive: FactoryArchive,
): Promise<void> {
  const archiveKits = [...archive.kits.keys()];
  report.fact("archive kit folders", archiveKits.length);
  report.fact(
    "archive WAVs",
    [...archive.kits.values()].reduce((n, f) => n + f.length, 0),
  );
  report.check(
    `the store has one kit per archive kit folder (${archiveKits.length})`,
    sameList(store.kits, archiveKits),
    { details: listDiff(store.kits, archiveKits) },
  );

  const bankNames = archive.bankFiles.map((f) => {
    const match = /^([A-Z]) - (.+)\.rtf$/i.exec(f);
    return match ? `${match[1]}:${match[2]}` : f;
  });
  const storeBanks = store.banks
    .filter((b) => b.artist)
    .map((b) => `${b.letter}:${b.artist}`);
  report.check(
    `bank names match the archive's ${archive.bankFiles.length} bank files`,
    sameList(
      storeBanks.map((b) => b.toLowerCase()),
      bankNames.map((b) => b.toLowerCase()),
    ),
    { details: listDiff(storeBanks, bankNames) },
  );

  let truncated = 0;
  const orderProblems: string[] = [];
  const byteProblems: string[] = [];
  let compared = 0;
  for (const [kit, files] of archive.kits) {
    for (let voice = 1; voice <= 4; voice++) {
      const all = voiceFiles(files, voice);
      truncated += Math.max(0, all.length - MAX_SLOTS);
      const expected = all.slice(0, MAX_SLOTS);
      const imported = store.samples.filter(
        (s) => s.kit_name === kit && s.voice_number === voice,
      );
      const names = imported.map((s) => s.filename);
      const slotsOk = imported.every((s, i) => s.slot_number === i);
      if (!slotsOk || names.join("\n") !== expected.join("\n")) {
        orderProblems.push(
          `${kit} voice ${voice}: got [${names.join(", ")}], expected [${expected.join(", ")}]`,
        );
      }
      for (const s of imported) {
        compared++;
        const stored = await fs.readFile(s.source_path).catch(() => null);
        if (!stored) {
          byteProblems.push(
            `${kit}/${s.filename}: missing at ${s.source_path}`,
          );
        } else if (!stored.equals(archive.read(kit, s.filename))) {
          byteProblems.push(`${kit}/${s.filename}: differs from the archive`);
        }
      }
    }
  }
  report.fact("files dropped by the 12-per-voice limit", truncated);
  report.check(
    "every voice holds the first 12 files in card order, in slots 1-12",
    orderProblems.length === 0,
    { details: orderProblems.slice(0, 5).join("; ") },
  );
  report.check(
    `${compared} imported files are byte-identical to the archive`,
    byteProblems.length === 0,
    { details: byteProblems.slice(0, 5).join("; ") },
  );
  // RE-34: setup imports in main, which reads every file's WAV header and
  // names voices from their first sample's file name
  const withoutMetadata = store.samples.filter(
    (s) =>
      s.wav_sample_rate === null ||
      s.wav_bit_depth === null ||
      s.wav_channels === null,
  );
  report.check(
    "every imported sample has its WAV format recorded",
    withoutMetadata.length === 0,
    {
      details: withoutMetadata
        .slice(0, 5)
        .map((s) => `${s.kit_name}/${s.filename}`)
        .join(", "),
    },
  );
  report.fact("voices named at setup", store.voiceNames.size);
  report.check(
    "setup names voices from their samples (A0 voice 2 holds snares)",
    /snare/i.test(store.voiceNames.get("A0:2") ?? ""),
    { details: `A0 voice 2: ${store.voiceNames.get("A0:2") ?? "unnamed"}` },
  );
  report.check(
    "no files outside the archive's kits were imported",
    store.samples.every((s) =>
      archive.kits.get(s.kit_name)?.includes(s.filename),
    ),
  );
}

/**
 * The files the Rample plays for one voice: names starting with the voice
 * digit, in the card's sort order, at most 12.
 */
export function voiceFiles(files: string[], voice: number): string[] {
  return files
    .filter((f) => f.startsWith(String(voice)))
    .sort((a, b) => a.localeCompare(b));
}
