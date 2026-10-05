import * as fs from "node:fs";

/**
 * Whether the card already holds a file's bytes, so a write can leave it
 * alone (#650). A write used to copy or convert every sample, so rewriting
 * a full card meant rewriting hundreds of megabytes the card already had,
 * and on an SD card writing is the slow part: each file costs its bytes,
 * a FAT update and, now and then, a stall while the card flushes. Reading
 * the card back to compare is much faster than writing it, and a size
 * check rules out most changed files without reading anything.
 *
 * Any error reading the card copy counts as "doesn't match": the write
 * then goes ahead and reports a real problem the way it always has.
 */

/** How much of each file is compared at a time */
const CHUNK_SIZE = 1024 * 1024;

/**
 * True when `cardPath` exists and holds exactly `bytes` (a converted
 * sample, encoded in memory).
 */
export async function cardFileHolds(
  cardPath: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const size = await fileSize(cardPath);
  if (size !== bytes.length) return false;
  const card = await openOrNull(cardPath);
  if (!card) return false;
  try {
    const buffer = Buffer.alloc(Math.min(CHUNK_SIZE, size));
    for (let offset = 0; offset < size; offset += buffer.length) {
      const length = Math.min(buffer.length, size - offset);
      // Each chunk follows the one before; one buffer is reused
      const { bytesRead } = await card.read(buffer, 0, length, offset); // NOSONAR: sequential by design
      if (
        bytesRead !== length ||
        !buffer
          .subarray(0, length)
          .equals(bytes.subarray(offset, offset + length))
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  } finally {
    await card.close();
  }
}

/**
 * True when `cardPath` exists and has the same bytes as `sourcePath` (a
 * sample copied as it is).
 */
export async function cardFileMatches(
  sourcePath: string,
  cardPath: string,
): Promise<boolean> {
  const [sourceSize, cardSize] = await Promise.all([
    fileSize(sourcePath),
    fileSize(cardPath),
  ]);
  if (sourceSize === null || sourceSize !== cardSize) return false;
  const [source, card] = await Promise.all([
    openOrNull(sourcePath),
    openOrNull(cardPath),
  ]);
  try {
    if (!source || !card) return false;
    const sourceBuffer = Buffer.alloc(Math.min(CHUNK_SIZE, sourceSize));
    const cardBuffer = Buffer.alloc(sourceBuffer.length);
    for (let offset = 0; offset < sourceSize; offset += sourceBuffer.length) {
      const length = Math.min(sourceBuffer.length, sourceSize - offset);
      // Each chunk follows the one before; the two buffers are reused
      const reads = Promise.all([
        source.read(sourceBuffer, 0, length, offset),
        card.read(cardBuffer, 0, length, offset),
      ]);
      const [fromSource, fromCard] = await reads; // NOSONAR: sequential by design
      if (
        fromSource.bytesRead !== length ||
        fromCard.bytesRead !== length ||
        !sourceBuffer.subarray(0, length).equals(cardBuffer.subarray(0, length))
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  } finally {
    await Promise.all([source?.close(), card?.close()]);
  }
}

/** A regular file's size, or null when there isn't one */
async function fileSize(filePath: string): Promise<null | number> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile() ? stats.size : null;
  } catch {
    return null;
  }
}

async function openOrNull(
  filePath: string,
): Promise<fs.promises.FileHandle | null> {
  try {
    return await fs.promises.open(filePath, "r");
  } catch {
    return null;
  }
}
