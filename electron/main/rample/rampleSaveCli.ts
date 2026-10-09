// `npm run rample:save -- <folder> [<folder>]` (#788): prints a copy of
// the Rample's `_save` folder, decoded, or the differences between two
// copies. Read-only: it never writes to either folder.

import * as fs from "node:fs";

import {
  formatRampleSaveDiff,
  formatRampleSaveFolder,
} from "./rampleSaveDiff.js";
import { readRampleSaveFolder } from "./rampleSaveReader.js";

const USAGE = [
  "Usage: npm run rample:save -- <_save folder> [<another copy>]",
  "",
  "  One folder: print every file, decoded, with the inferred firmware.",
  "  Two folders: print what changed from the first to the second.",
  "",
  "Read-only: nothing is written to either folder.",
];

/** Runs the script with its arguments, printing through `print`; returns the exit code. */
export async function runRampleSaveCli(
  args: readonly string[],
  print: (line: string) => void,
): Promise<number> {
  if (args.length < 1 || args.length > 2 || args.includes("--help")) {
    for (const line of USAGE) print(line);
    return args.includes("--help") ? 0 : 2;
  }
  for (const folder of args) {
    if (!(await isFolder(folder))) {
      print(`Not a folder: ${folder}`);
      return 1;
    }
  }

  const [first, second] = await Promise.all(args.map(readRampleSaveFolder));
  const lines = second
    ? [
        `Comparing ${args[0]} -> ${args[1]}`,
        "",
        ...formatRampleSaveDiff(first, second),
      ]
    : [`_save folder: ${args[0]}`, "", ...formatRampleSaveFolder(first)];
  for (const line of lines) print(line);
  return 0;
}

async function isFolder(folder: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(folder)).isDirectory();
  } catch {
    return false;
  }
}
