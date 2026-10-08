/**
 * A small sample library made of generated tones, laid out as on a Rample
 * SD card and in Squarp's factory archive (RE-67). The e2e specs use it
 * instead of stub files, so setup and the write handle real WAV audio:
 * mono and stereo, in formats the Rample plays as they are and in formats
 * Romper converts. Nothing here is anyone else's audio.
 *
 * Setup gives each file the voice its name starts with, in name order, and
 * links a voice as stereo when it holds only stereo files and the next
 * voice is empty (#537 rule 2). So B1's voices 1 and 2 arrive linked, and
 * B1's voice 4 (which can't be linked) has its stereo file mixed down when
 * it's written.
 */
import AdmZip from "adm-zip";
import fs from "fs-extra";
import path from "node:path";

import { encodeTestWav, sine, type WavFormat } from "../validation/support/wav";
import { openStoreDb } from "./e2e-store-db";

export interface GeneratedSample {
  bytes: Buffer;
  file: string;
  kit: string;
  /** Slot, from 0, as setup orders the voice's files */
  slot: number;
  voice: number;
}

type Format = Omit<WavFormat, "channels">;

function tone(
  hz: number,
  channels: 1 | 2,
  format: Format = { bitDepth: 16, encoding: "pcm", sampleRate: 44100 },
): Buffer {
  const left = sine(hz, 0.2, format.sampleRate, 0.5);
  const audio =
    channels === 1
      ? [left]
      : [left, sine(hz * 1.5, 0.2, format.sampleRate, 0.4)];
  return encodeTestWav(audio, format);
}

const pcm24at48k: Format = { bitDepth: 24, encoding: "pcm", sampleRate: 48000 };

function sample(
  kit: string,
  file: string,
  slot: number,
  bytes: Buffer,
): GeneratedSample {
  return { bytes, file, kit, slot, voice: Number(file[0]) };
}

export const GENERATED_SAMPLES: readonly GeneratedSample[] = [
  sample("A0", "1 KICK 1.wav", 0, tone(55, 1)),
  sample(
    "A0",
    "1 KICK 2.wav",
    1,
    tone(65, 1, { bitDepth: 8, encoding: "pcm", sampleRate: 44100 }),
  ),
  sample("A0", "2 SNARE.wav", 0, tone(180, 1)),
  sample("B1", "1 PAD 1.wav", 0, tone(220, 2)),
  sample("B1", "1 PAD 2.wav", 1, tone(247, 2, pcm24at48k)),
  sample("B1", "3 HAT.wav", 0, tone(880, 1, pcm24at48k)),
  sample("B1", "4 LOOP.wav", 0, tone(110, 2)),
];

/** The kits, in name order */
export const GENERATED_KITS = [
  ...new Set(GENERATED_SAMPLES.map((s) => s.kit)),
].sort((a, b) => a.localeCompare(b));

/** Bank letter → name, from the bank name files */
export const GENERATED_BANK_NAMES: Readonly<Record<string, string>> = {
  A: "ALWIS",
};

const BANK_FILES: Record<string, Buffer> = {
  "A - ALWIS.rtf": Buffer.from(String.raw`{\rtf1\ansi ALWIS}`),
};

export interface ImportedLibrary {
  /** Bank letter → name */
  banks: Record<string, string>;
  kits: string[];
  /** `kit:voice` for each voice linked as stereo */
  linkedVoices: string[];
  /** Each sample, and whether the store's file is byte-identical */
  samples: {
    filename: string;
    identical: boolean;
    kit_name: string;
    slot_number: number;
    voice_number: number;
  }[];
}

/** What setup should import from the generated library */
export function expectedImport(): ImportedLibrary {
  return {
    banks: { ...GENERATED_BANK_NAMES },
    kits: GENERATED_KITS,
    linkedVoices: ["B1:1"],
    samples: GENERATED_SAMPLES.map((s) => ({
      filename: s.file,
      identical: true,
      kit_name: s.kit,
      slot_number: s.slot,
      voice_number: s.voice,
    })),
  };
}

/** The library as a factory archive, with macOS's `__MACOSX` copies */
export function generatedFactoryArchive(): Buffer {
  const zip = new AdmZip();
  for (const s of GENERATED_SAMPLES) zip.addFile(`${s.kit}/${s.file}`, s.bytes);
  for (const [name, bytes] of Object.entries(BANK_FILES)) {
    zip.addFile(name, bytes);
    zip.addFile(`__MACOSX/._${name}`, Buffer.from("metadata"));
  }
  return zip.toBuffer();
}

/** What a store holds after setup, from its database and its files */
export async function readImport(store: string): Promise<ImportedLibrary> {
  const db = openStoreDb(store, { readOnly: true });
  let rows: {
    filename: string;
    kit_name: string;
    slot_number: number;
    source_path: string;
    voice_number: number;
  }[];
  let result: Omit<ImportedLibrary, "samples">;
  try {
    rows = db
      .prepare(
        `SELECT kit_name, voice_number, slot_number, filename, source_path
           FROM samples ORDER BY kit_name, voice_number, slot_number`,
      )
      .all() as typeof rows;
    const kits = db.prepare("SELECT name FROM kits ORDER BY name").all() as {
      name: string;
    }[];
    const linked = db
      .prepare(
        "SELECT kit_name, voice_number FROM voices WHERE stereo_mode = 1 ORDER BY kit_name, voice_number",
      )
      .all() as { kit_name: string; voice_number: number }[];
    const banks = db
      .prepare(
        "SELECT letter, artist FROM banks WHERE artist IS NOT NULL ORDER BY letter",
      )
      .all() as { artist: string; letter: string }[];
    result = {
      banks: Object.fromEntries(banks.map((b) => [b.letter, b.artist])),
      kits: kits.map((k) => k.name),
      linkedVoices: linked.map((v) => `${v.kit_name}:${v.voice_number}`),
    };
  } finally {
    db.close();
  }

  const samples = [];
  for (const { source_path, ...row } of rows) {
    const generated = GENERATED_SAMPLES.find(
      (s) => s.kit === row.kit_name && s.file === row.filename,
    );
    const stored = await fs.readFile(source_path).catch(() => null);
    samples.push({
      ...row,
      identical: !!generated && !!stored && stored.equals(generated.bytes),
    });
  }
  return { ...result, samples };
}

/** The library as a Rample SD card at `dir` */
export async function writeGeneratedCard(dir: string): Promise<void> {
  for (const s of GENERATED_SAMPLES) {
    await fs.outputFile(path.join(dir, s.kit, s.file), s.bytes);
  }
  for (const [name, bytes] of Object.entries(BANK_FILES)) {
    await fs.outputFile(path.join(dir, name), bytes);
  }
}
