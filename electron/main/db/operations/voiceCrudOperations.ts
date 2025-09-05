import type { DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";

const { voices } = schema;

/**
 * Update voice alias
 */
export function updateVoiceAlias(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  alias: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(voices)
      .set({ voice_alias: alias })
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();
  });
}
