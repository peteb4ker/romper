import * as fs from "node:fs";
import * as path from "node:path";

import { isSourcePathReferenced } from "../db/operations/sampleSourceQueries.js";
import { getKitSamples } from "../db/romperDbCoreORM.js";
import { DB_FILENAME } from "../db/utils/dbUtilities.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { pathAccess, type PathAccessResult } from "./pathAccess.js";

/**
 * Read authorization for individual sample source files (RE-03).
 *
 * Samples are referenced, not copied, so a kit's source files can live
 * anywhere the user dragged them from. A renderer-supplied sample path is
 * accepted for reading when:
 *
 * 1. it is inside an allowed root, or was dropped by the user this session
 *    (pathAccess), or
 * 2. the configured store already references it: the database is the durable
 *    record of paths the user added in earlier sessions (insert paths are
 *    themselves guarded, so it can't be seeded from the renderer), or
 * 3. main saw the store reference it before an edit this session
 *    (`rememberKitSampleSources`), so undo can put a deleted or replaced
 *    sample back.
 */

type Settings = Record<string, unknown>;

export function checkSampleSourceAccess(
  settings: Settings,
  filePath: unknown,
): PathAccessResult {
  const direct = pathAccess.check(filePath, "read");
  if (direct.ok) return direct;
  if (typeof filePath === "string" && isReferencedByStore(settings, filePath)) {
    return { ok: true };
  }
  return direct;
}

/**
 * Record the source files the given kits reference right now, before a
 * handler deletes, replaces or moves samples, so undo can re-add them.
 * Best effort: a lookup failure only means undo may be refused later.
 */
export function rememberKitSampleSources(
  settings: Settings,
  ...kitNames: unknown[]
): void {
  const dbDir = getStoreDbDir(settings);
  if (!dbDir) return;
  for (const kitName of kitNames) {
    if (typeof kitName !== "string" || kitName === "") continue;
    try {
      const result = getKitSamples(dbDir, kitName);
      for (const sample of result.data ?? []) {
        pathAccess.grantRead(sample.source_path);
      }
    } catch {
      // Ignore: the edit itself will report any database problem.
    }
  }
}

function getStoreDbDir(settings: Settings): null | string {
  const storePath = ServicePathManager.getLocalStorePath(settings);
  if (!storePath) return null;
  const dbDir = ServicePathManager.getDbPath(storePath);
  // Don't let a lookup create a database where none exists.
  return fs.existsSync(path.join(dbDir, DB_FILENAME)) ? dbDir : null;
}

function isReferencedByStore(settings: Settings, filePath: string): boolean {
  if (!path.isAbsolute(filePath)) return false;
  const dbDir = getStoreDbDir(settings);
  if (!dbDir) return false;
  // Paths are stored as the user gave them, which is normally already
  // resolved; match either form, without loading every row (RE-85)
  const wanted = [...new Set([filePath, path.resolve(filePath)])];
  try {
    return isSourcePathReferenced(dbDir, wanted).data === true;
  } catch {
    return false;
  }
}
