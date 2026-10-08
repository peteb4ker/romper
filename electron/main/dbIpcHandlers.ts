import type { DbResult } from "@romper/shared/db/schema.js";
import type { VoiceSliceSettings } from "@romper/shared/sliceTypes.js";
import type { SequenceSnapshot } from "@romper/shared/undoTypes.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import {
  isSlicerDivision,
  normalizeSliceSteps,
} from "@romper/shared/sliceTypes.js";
// IMPORTANT: Drizzle ORM with better-sqlite3 is SYNCHRONOUS - do not use await with database operations
import { ipcMain } from "electron";

import type { InMemorySettings } from "./types/settings.js";

import { validateSampleFormat } from "./audioUtils.js";
import { registerFavoritesIpcHandlers } from "./db/favoritesIpcHandlers.js";
import { createDbHandler } from "./db/ipcHandlerUtils.js";
import { kitNotEditableError } from "./db/operations/kitEditableGuard.js";
import {
  getAllBanks,
  getKit,
  getKits,
  getKitSamples,
  updateBank,
  updateKit,
  updateSampleGain,
  updateVoiceAlias,
  updateVoiceSampleMode,
  updateVoiceSliceSettings,
  updateVoiceStereoMode,
  updateVoiceVolume,
} from "./db/romperDbCoreORM.js";
import { registerSampleIpcHandlers } from "./db/sampleIpcHandlers.js";
import { registerSyncIpcHandlers } from "./db/syncIpcHandlers.js";
import {
  bpmError,
  firstError,
  gainError,
  sampleModeError,
  slotNumberError,
  voiceNumberError,
  volumeError,
} from "./ipcValidation.js";
import { parseKitMetadataUpdates } from "./kitMetadataUpdates.js";
import {
  checkPathAccess,
  checkSetupDatabaseDirAccess,
  checkSetupPathAccess,
  pathAccess,
} from "./security/pathAccess.js";
import { checkSampleSourceAccess } from "./security/sampleSourceAccess.js";
import { localStoreService } from "./services/localStoreService.js";
import { localStoreSetupService } from "./services/localStoreSetupService.js";
import {
  bankNameError,
  bankRtfFileName,
  isBankLetter,
  rtfFileService,
  type StagedRtfFile,
} from "./services/rtfFileService.js";
import { scanService } from "./services/scanService.js";
import { ServicePathManager } from "./utils/fileSystemUtils.js";

export function registerDbIpcHandlers(inMemorySettings: InMemorySettings) {
  pathAccess.useSettings(inMemorySettings);

  // Register all handler groups
  registerSampleIpcHandlers(inMemorySettings);
  registerSyncIpcHandlers(inMemorySettings);
  registerFavoritesIpcHandlers(inMemorySettings);

  // Setup-wizard database operations. They run before the new store is
  // configured, so they name its .romperdb folder; it must sit inside a
  // writable root (RE-03). create-romper-db also refuses a folder that
  // already holds a store (RE-10), and setup-import-kit and
  // setup-import-bank-names only import into a store this setup created
  // (RE-34).
  ipcMain.handle("create-romper-db", async (_event, dbDir: string) => {
    const access = await checkSetupDatabaseDirAccess(dbDir);
    if (!access.ok) return { error: access.error, success: false };
    return localStoreSetupService.createSetupDatabase(dbDir);
  });

  ipcMain.handle(
    "setup-import-kit",
    async (_event, dbDir: string, kitName: string) => {
      const access = await checkSetupDatabaseDirAccess(dbDir);
      if (!access.ok) return { error: access.error, success: false };
      return localStoreSetupService.importSetupKit(dbDir, kitName);
    },
  );

  // The bank names of the card setup is copying from (#564), or of the
  // factory archive extracted into the new store (#567), in the same step
  // as the kits. Either folder is one the user picked, so main has granted
  // it
  ipcMain.handle(
    "setup-import-bank-names",
    async (_event, dbDir: string, sourcePath: string) => {
      const access = await checkSetupDatabaseDirAccess(dbDir);
      const sourceAccess = access.ok
        ? await checkSetupPathAccess(sourcePath)
        : access;
      if (!sourceAccess.ok)
        return { error: sourceAccess.error, success: false };
      return localStoreSetupService.importSetupBankNames(dbDir, sourcePath);
    },
  );

  ipcMain.handle(
    "get-kit",
    createDbHandler(inMemorySettings, (dbDir: string, kitName: string) => {
      return getKit(dbDir, kitName);
    }),
  );

  // Kit details: only the alias and the editable flag (RE-22). Spreading
  // the renderer's object into the update let it rename the kit, change its
  // bank or clear its lock.
  ipcMain.handle(
    "update-kit-metadata",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, updates: unknown) => {
        const parsed = parseKitMetadataUpdates(updates);
        if (!parsed.ok) return { error: parsed.error, success: false };
        return updateKit(dbDir, kitName, parsed.updates);
      },
    ),
  );

  ipcMain.handle(
    "get-all-kits",
    createDbHandler(inMemorySettings, (dbDir: string) => {
      return getKits(dbDir);
    }),
  );

  ipcMain.handle(
    "update-voice-alias",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        kitName: string,
        voiceNumber: number,
        voiceAlias: string,
      ) => {
        const invalid = firstError(voiceNumberError(voiceNumber));
        if (invalid) return invalid;
        return updateVoiceAlias(dbDir, kitName, voiceNumber, voiceAlias);
      },
    ),
  );

  ipcMain.handle(
    "update-sample-gain",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        kitName: string,
        voiceNumber: number,
        slotNumber: number,
        gainDb: number,
      ) => {
        // Out-of-range or non-numeric settings are refused here, before
        // they reach the database or the card (RE-25)
        const invalid = firstError(
          voiceNumberError(voiceNumber),
          slotNumberError(slotNumber),
          gainError(gainDb),
        );
        if (invalid) return invalid;
        return updateSampleGain(
          dbDir,
          kitName,
          voiceNumber,
          slotNumber,
          gainDb,
        );
      },
    ),
  );

  ipcMain.handle(
    "update-voice-volume",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, voiceNumber: number, volume: number) => {
        const invalid = firstError(
          voiceNumberError(voiceNumber),
          volumeError(volume),
        );
        if (invalid) return invalid;
        return updateVoiceVolume(dbDir, kitName, voiceNumber, volume);
      },
    ),
  );

  ipcMain.handle(
    "update-voice-sample-mode",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        kitName: string,
        voiceNumber: number,
        sampleMode: string,
      ) => {
        const invalid = firstError(
          voiceNumberError(voiceNumber),
          sampleModeError(sampleMode),
        );
        if (invalid) return invalid;
        return updateVoiceSampleMode(dbDir, kitName, voiceNumber, sampleMode);
      },
    ),
  );

  ipcMain.handle(
    "update-voice-stereo-mode",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        kitName: string,
        voiceNumber: number,
        stereoMode: boolean,
      ) => {
        const invalid = firstError(
          voiceNumberError(voiceNumber),
          typeof stereoMode === "boolean"
            ? null
            : "Stereo mode must be true or false",
        );
        if (invalid) return invalid;
        // Linking is an edit: it decides what the next write puts on the
        // card (stereo, or a mono mix), so a read-only kit keeps its
        // setting (RE-71)
        const kit = getKit(dbDir, kitName);
        if (!kit.success) return { error: kit.error, success: false };
        if (!kit.data) {
          return { error: `Kit ${kitName} not found`, success: false };
        }
        if (!kit.data.editable) {
          return {
            error: `${kitNotEditableError(kitName)} Make it editable to link or unlink voices.`,
            success: false,
          };
        }
        // Refuses a link the kit editor would refuse (voice 4, a voice in a
        // pair, a next voice with samples), in the update's transaction (#541)
        return updateVoiceStereoMode(dbDir, kitName, voiceNumber, stereoMode);
      },
    ),
  );

  ipcMain.handle(
    "update-kit-bpm",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, bpm: number) => {
        const invalid = firstError(bpmError(bpm));
        if (invalid) return invalid;
        return updateKit(dbDir, kitName, { bpm });
      },
    ),
  );

  ipcMain.handle(
    "update-step-pattern",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, stepPattern: number[][]) => {
        return updateKit(dbDir, kitName, { step_pattern: stepPattern });
      },
    ),
  );

  ipcMain.handle(
    "update-trigger-conditions",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        kitName: string,
        triggerConditions: (null | string)[][],
      ) => {
        return updateKit(dbDir, kitName, {
          trigger_conditions: triggerConditions,
        });
      },
    ),
  );

  ipcMain.handle(
    "update-slice-steps",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, sliceSteps: unknown) => {
        return updateKit(dbDir, kitName, {
          slice_steps: normalizeSliceSteps(sliceSteps),
        });
      },
    ),
  );

  // Undo and redo put back the parts of a sequence that differ, in one
  // statement, so a failure leaves none of them changed (#570)
  ipcMain.handle(
    "restore-kit-sequence",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, parts: Partial<SequenceSnapshot>) => {
        const { sliceSteps, stepPattern, triggerConditions } = parts ?? {};
        const given = [sliceSteps, stepPattern, triggerConditions].filter(
          (part) => part !== undefined,
        );
        if (given.length === 0 || !given.every(Array.isArray)) {
          return { error: "No sequence to restore", success: false };
        }
        return updateKit(dbDir, kitName, {
          ...(stepPattern && { step_pattern: stepPattern }),
          ...(triggerConditions && { trigger_conditions: triggerConditions }),
          ...(sliceSteps && { slice_steps: normalizeSliceSteps(sliceSteps) }),
        });
      },
    ),
  );

  ipcMain.handle(
    "update-kit-slicer-division",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, division: number) => {
        if (!isSlicerDivision(division)) {
          return {
            error: `Invalid slicer division: ${division}`,
            success: false,
          };
        }
        return updateKit(dbDir, kitName, { slicer_division: division });
      },
    ),
  );

  ipcMain.handle(
    "update-voice-slice-settings",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        kitName: string,
        voiceNumber: number,
        settings: Partial<VoiceSliceSettings>,
      ) => {
        const invalid = firstError(voiceNumberError(voiceNumber));
        if (invalid) return invalid;
        return updateVoiceSliceSettings(dbDir, kitName, voiceNumber, settings);
      },
    ),
  );

  ipcMain.handle(
    "validate-local-store",
    async (_event, localStorePath?: string) => {
      // Check environment override first, then provided path, then settings
      const settingsPath =
        typeof inMemorySettings.localStorePath === "string"
          ? inMemorySettings.localStorePath
          : undefined;
      const pathToValidate =
        process.env.ROMPER_LOCAL_PATH || localStorePath || settingsPath;
      if (!pathToValidate) {
        throw new Error("No local store path provided or configured");
      }
      const access = await checkPathAccess(pathToValidate);
      if (!access.ok) return { error: access.error, isValid: false };
      return localStoreService.validateLocalStore(pathToValidate);
    },
  );

  ipcMain.handle(
    "validate-local-store-basic",
    async (_event, localStorePath?: string) => {
      // Check environment override first, then provided path, then settings
      const settingsPath =
        typeof inMemorySettings.localStorePath === "string"
          ? inMemorySettings.localStorePath
          : undefined;
      const pathToValidate =
        process.env.ROMPER_LOCAL_PATH || localStorePath || settingsPath;
      if (!pathToValidate) {
        throw new Error("No local store path provided or configured");
      }
      const access = await checkPathAccess(pathToValidate);
      if (!access.ok) return { error: access.error, isValid: false };
      return localStoreService.validateLocalStoreBasic(pathToValidate);
    },
  );

  ipcMain.handle(
    "get-all-samples-for-kit",
    createDbHandler(inMemorySettings, (dbDir: string, kitName: string) => {
      return getKitSamples(dbDir, kitName);
    }),
  );

  ipcMain.handle("rescan-kit", (_event, kitName: string) => {
    return scanService.rescanKit(inMemorySettings, kitName);
  });

  // The kit editor checks files it doesn't know are readable, once per
  // kit open, so missing and unreadable samples show early (#537)
  ipcMain.handle("check-kit-sample-files", (_event, kitName: string) => {
    if (typeof kitName !== "string" || kitName === "") {
      return { error: "Kit name must be a string", success: false };
    }
    return scanService.checkKitSampleFiles(inMemorySettings, kitName);
  });

  // Bank operations: the bank strip loads every bank's name, including
  // banks with no kits (#512)
  ipcMain.handle(
    "get-all-banks",
    createDbHandler(inMemorySettings, (dbDir: string) => {
      return getAllBanks(dbDir);
    }),
  );

  // Rename or clear a bank (RE-23). An empty or null artist clears the name
  // in the database as well as its RTF file, so it stays gone after a
  // reload and the next write removes it from the card. The table and the
  // store's file change together, or neither does (#567).
  ipcMain.handle(
    "update-bank",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        bankLetter: string,
        updates: { artist?: null | string },
      ) => {
        if (!isBankLetter(bankLetter)) {
          return {
            error: `Invalid bank letter: ${JSON.stringify(bankLetter)}`,
            success: false,
          };
        }
        const artist = updates?.artist?.trim() || null;
        if (artist) {
          const nameError = bankNameError(artist);
          if (nameError) return { error: nameError, success: false };
        }
        return saveBankName(
          dbDir,
          ServicePathManager.getLocalStorePath(inMemorySettings),
          bankLetter,
          artist,
        );
      },
    ),
  );

  // Audio format validation
  ipcMain.handle("validate-sample-format", async (_event, filePath: string) => {
    const access = await checkSampleSourceAccess(inMemorySettings, filePath);
    if (!access.ok) return { error: access.error, success: false };
    return validateSampleFormat(filePath);
  });

  // Progress events are handled via webContents.send in syncService
  // No IPC handler needed for onSyncProgress as it's a renderer-side event listener
}

/**
 * Save a bank's name (`banks.artist`, its owner) and the store's name file
 * written from it, together (#567). The file change is staged first, so a
 * name that can't be written never reaches the database; if the database
 * then refuses it, the file change is undone, leaving both as they were.
 */
function saveBankName(
  dbDir: string,
  localStorePath: null | string,
  bankLetter: string,
  artist: null | string,
): DbResult<void> {
  let staged: null | StagedRtfFile = null;
  try {
    if (localStorePath) {
      staged = rtfFileService.stageRtfFile(localStorePath, bankLetter, artist);
    }
  } catch (error) {
    return {
      error: `Couldn't save the name of bank ${bankLetter}: ${getErrorMessage(error)}`,
      success: false,
    };
  }

  const saved = updateBank(dbDir, bankLetter, {
    artist,
    rtf_filename: artist ? bankRtfFileName(bankLetter, artist) : null,
  });
  try {
    if (saved.success) staged?.commit();
    else staged?.rollback();
  } catch (error) {
    console.error(
      `[update-bank] Bank ${bankLetter}: couldn't tidy its name file after ${saved.success ? "saving" : "a failed save"}:`,
      getErrorMessage(error),
    );
  }
  return saved;
}
