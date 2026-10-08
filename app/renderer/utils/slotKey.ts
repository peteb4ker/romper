/**
 * Key for per-slot state in the kit editor: playback triggers, playing state
 * and sample metadata such as gain. Keyed by voice and zero-based slot, never
 * by file name: one voice can hold two files with the same name, and so can
 * two voices (RE-45).
 */
export function slotKey(voice: number, slot: number): string {
  return `${voice}:${slot}`;
}

/**
 * The file in a slot, for keying audio loaded from it (#575): the sample
 * row's source path, when that row holds the file the slot shows. A delete
 * or move shifts the samples after it up a slot, and two files can share a
 * name, so neither the slot nor the file name tells which file it holds.
 *
 * Null when the row is missing or holds another file: the rows come from a
 * separate load that can lag the slots while a kit reloads after an edit.
 */
export function slotSampleSource(
  row: { filename: string; source_path: string } | undefined,
  filename: null | string | undefined,
): null | string {
  return row && filename && row.filename === filename ? row.source_path : null;
}
