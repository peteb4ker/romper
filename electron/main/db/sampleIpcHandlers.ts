import type { RestoreMissingFileRequest } from "@romper/shared/electronApi.js";
import type { VoiceSnapshot } from "@romper/shared/undoTypes.js";

import { describeSearchFolderPrompt } from "@romper/shared/storeCheckWording.js";
import { dialog } from "electron";

import { handle } from "../ipcHandle.js";
import {
  checkSampleSourceAccess,
  rememberKitSampleSources,
} from "../security/sampleSourceAccess.js";
import {
  restoreMissingFile,
  undoRestoreMissingFile,
} from "../services/missingFileRestore.js";
import { missingFileSearch } from "../services/missingFileSearch.js";
import {
  putBackMissingSamples,
  removeMissingSamples,
} from "../services/missingSampleRemoval.js";
import { sampleService } from "../services/sampleService.js";
import { storeCheckService } from "../services/storeCheckService.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
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

  // "Remove missing samples" (#822, stage 5 of docs/developer/store-check.md)
  // and its undo, on read-only kits too (D5). Main checks each file again
  // before removing its row. Undo puts back only what the removal took,
  // and its files must be ones Romper may read (RE-03), as for
  // restore-kit-voices. Either way the store check looks at the kit again
  // once this call is over, so its badge, the status bar and the Library
  // check follow at once.
  handle(
    "remove-missing-samples",
    async (_event, kitName: string, undo?: VoiceSnapshot[]) => {
      if (typeof kitName !== "string" || kitName === "") {
        return { error: "Kit name must be a string", success: false };
      }
      if (undo !== undefined && !Array.isArray(undo)) {
        return { error: "No voices to restore", success: false };
      }
      const localStorePath =
        ServicePathManager.getLocalStorePath(inMemorySettings);
      if (!localStorePath) {
        return { error: "No local store path configured", success: false };
      }
      let result;
      if (undo === undefined) {
        // Undo puts back what this removes; let it read those paths again
        await rememberKitSampleSources(inMemorySettings, kitName);
        result = await removeMissingSamples(localStorePath, kitName);
      } else {
        const sourcePaths = undo.flatMap((voice) =>
          (voice?.samples ?? []).map((sample) => sample?.source_path),
        );
        for (const sourcePath of sourcePaths) {
          const access = await checkSampleSourceAccess(
            // NOSONAR: the first refusal, in order
            inMemorySettings,
            sourcePath,
          );
          if (!access.ok) return { error: access.error, success: false };
        }
        // Redo removes them again
        await rememberKitSampleSources(inMemorySettings, kitName);
        result = putBackMissingSamples(localStorePath, kitName, undo);
      }
      if (result.success) storeCheckService.recheckKit(kitName);
      return result;
    },
  );

  // "Find missing files…" (#823, stage 6 of docs/developer/store-check.md).
  // Main shows the folder dialog (D1) and searches only the store's kit
  // folders and the folder chosen there (Q-03); main checks every file
  // again before searching for it or putting one back.
  handle("pick-search-folder", async (_event, kitName: string) => {
    const localStorePath = storePathFor(inMemorySettings, kitName);
    if (typeof localStorePath !== "string") return localStorePath;
    return missingFileSearch.pickFolder(
      localStorePath,
      kitName,
      (options) => dialog.showOpenDialog(options),
      describeSearchFolderPrompt,
    );
  });

  handle(
    "find-missing-files",
    async (_event, kitName: string, folder: string) => {
      const localStorePath = storePathFor(inMemorySettings, kitName);
      if (typeof localStorePath !== "string") return localStorePath;
      if (typeof folder !== "string" || folder === "") {
        return { error: "Folder must be a string", success: false };
      }
      return missingFileSearch.find(localStorePath, kitName, folder);
    },
  );

  handle("cancel-find-missing-files", () => missingFileSearch.cancel());

  // Puts a found file back, or undoes that. Either way the store check
  // looks at the kit again once this call is over, so its badge, the status
  // bar and the Library check follow at once.
  handle(
    "restore-missing-file",
    async (_event, kitName: string, request: RestoreMissingFileRequest) => {
      const localStorePath = storePathFor(inMemorySettings, kitName);
      if (typeof localStorePath !== "string") return localStorePath;
      const invalid = invalidRestoreRequest(request);
      if (invalid) return { error: invalid, success: false };
      const result =
        request.kind === "undo"
          ? await undoRestoreMissingFile(
              localStorePath,
              kitName,
              request.restored,
            )
          : await restoreMissingFile(
              localStorePath,
              kitName,
              request.sampleId,
              request.foundPath,
            );
      if (result.success) storeCheckService.recheckKit(kitName);
      return result;
    },
  );
}

/** Why a restore request can't be used, or null */
function invalidRestoreRequest(
  request: RestoreMissingFileRequest,
): null | string {
  if (request?.kind === "restore") {
    return Number.isInteger(request.sampleId) &&
      typeof request.foundPath === "string" &&
      request.foundPath !== ""
      ? null
      : "Invalid file to restore";
  }
  if (request?.kind === "undo") {
    const restored = request.restored;
    const valid =
      Number.isInteger(restored?.sampleId) &&
      (restored.kind === "copy"
        ? typeof restored.path === "string"
        : restored.kind === "repoint" &&
          typeof restored.from === "string" &&
          typeof restored.to === "string");
    return valid ? null : "Invalid restore to undo";
  }
  return "Invalid restore request";
}

/** The store to work in, or the result that says why there is none */
function storePathFor(
  inMemorySettings: Record<string, unknown>,
  kitName: unknown,
): { error: string; success: false } | string {
  if (typeof kitName !== "string" || kitName === "") {
    return { error: "Kit name must be a string", success: false };
  }
  const localStorePath = ServicePathManager.getLocalStorePath(inMemorySettings);
  if (!localStorePath) {
    return { error: "No local store path configured", success: false };
  }
  return localStorePath;
}
