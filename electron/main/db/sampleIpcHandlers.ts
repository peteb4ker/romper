import type { VoiceSnapshot } from "@romper/shared/undoTypes.js";

import { handle } from "../ipcHandle.js";
import {
  checkSampleSourceAccess,
  rememberKitSampleSources,
} from "../security/sampleSourceAccess.js";
import { sampleService } from "../services/sampleService.js";
import {
  createSampleOperationHandler,
  readKitRows,
  withEditedKitSamples,
} from "./ipcHandlerUtils.js";

/**
 * Registers all sample-related IPC handlers
 */
export function registerSampleIpcHandlers(
  inMemorySettings: Record<string, unknown>,
) {
  handle(
    "add-sample-to-slot",
    createSampleOperationHandler(inMemorySettings, "add"),
  );

  handle(
    "delete-sample-from-slot",
    createSampleOperationHandler(inMemorySettings, "delete"),
  );

  handle(
    "move-sample-in-kit",
    async (
      _event,
      kitName: string,
      fromVoice: number,
      fromSlot: number,
      toVoice: number,
      toSlot: number,
    ) => {
      try {
        await rememberKitSampleSources(inMemorySettings, kitName);
        const rows = readKitRows(inMemorySettings, kitName);
        return withEditedKitSamples(
          inMemorySettings,
          kitName,
          sampleService.moveSampleInKit(
            inMemorySettings,
            kitName,
            fromVoice,
            fromSlot,
            toVoice,
            toSlot,
            "insert",
          ),
          { rows, voices: [fromVoice, toVoice] },
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          error: `Failed to move sample: ${errorMessage}`,
          success: false,
        };
      }
    },
  );

  handle(
    "move-sample-between-kits",
    async (
      _event,
      params: {
        fromKit: string;
        fromSlot: number;
        fromVoice: number;
        mode: "insert";
        toKit: string;
        toSlot: number;
        toVoice: number;
      },
    ) => {
      try {
        await rememberKitSampleSources(
          inMemorySettings,
          params?.fromKit,
          params?.toKit,
        );
        const result = sampleService.moveSampleBetweenKits(
          inMemorySettings,
          params,
        );
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          error: `Failed to move sample between kits: ${errorMessage}`,
          success: false,
        };
      }
    },
  );

  // Undo puts voices back as they were, in one transaction (RE-86). Every
  // file it restores must be one Romper may read (RE-03): the edit being
  // undone remembered the kit's files before it removed them.
  handle(
    "restore-kit-voices",
    async (_event, kitName: string, voices: VoiceSnapshot[]) => {
      if (!Array.isArray(voices)) {
        return { error: "No voices to restore", success: false };
      }
      const sourcePaths = voices.flatMap((voice) =>
        (voice?.samples ?? []).map((sample) => sample?.source_path),
      );
      const checks = await Promise.all(
        sourcePaths.map((p) => checkSampleSourceAccess(inMemorySettings, p)),
      );
      // The first refusal, as checking one file at a time would report
      const denied = checks.find((access) => !access.ok);
      if (denied && !denied.ok) return { error: denied.error, success: false };
      // Redo removes what this restores; let it read those files again
      await rememberKitSampleSources(inMemorySettings, kitName);
      return sampleService.restoreVoices(inMemorySettings, kitName, voices);
    },
  );
}
