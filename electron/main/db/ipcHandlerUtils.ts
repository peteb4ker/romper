import type { DbResult, Sample } from "@romper/shared/db/schema.js";
import type { SampleEditKit } from "@romper/shared/electronApi.js";
import type { IpcResult } from "@romper/shared/ipcChannels.js";

import { snapshotVoices } from "@romper/shared/undoTypes.js";

import {
  checkSampleSourceAccess,
  rememberKitSampleSources,
} from "../security/sampleSourceAccess.js";
import { sampleService } from "../services/sampleService.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { getKit, getKitSamples } from "./romperDbCoreORM.js";

type AddSampleHandler = (
  _event: unknown,
  kitName: string,
  voiceNumber: number,
  slotNumber: number,
  filePath?: string,
) => Promise<IpcResult<"add-sample-to-slot">>;

type DeleteSampleHandler = (
  _event: unknown,
  kitName: string,
  voiceNumber: number,
  slotNumber: number,
) => Promise<IpcResult<"delete-sample-from-slot">>;

/**
 * Creates a wrapper for IPC handlers that require database directory validation
 */
export function createDbHandler<T extends unknown[], R>(
  inMemorySettings: Record<string, unknown>,
  handler: (dbDir: string, ...args: T) => Promise<R> | R,
): (_event: unknown, ...args: T) => Promise<R> {
  return async (_event: unknown, ...args: T): Promise<R> => {
    const dbDirResult = validateAndGetDbDir(inMemorySettings);
    if (!dbDirResult.success) {
      return { error: dbDirResult.error, success: false } as R;
    }
    return handler(dbDirResult.dbDir!, ...args);
  };
}

/**
 * Creates a sample operation handler using the sample service
 */
export function createSampleOperationHandler(
  inMemorySettings: Record<string, unknown>,
  operationType: "add",
): AddSampleHandler;
export function createSampleOperationHandler(
  inMemorySettings: Record<string, unknown>,
  operationType: "delete",
): DeleteSampleHandler;
export function createSampleOperationHandler(
  inMemorySettings: Record<string, unknown>,
  operationType: "add" | "delete",
): AddSampleHandler | DeleteSampleHandler {
  switch (operationType) {
    case "add": {
      const add: AddSampleHandler = (
        _event,
        kitName,
        voiceNumber,
        slotNumber,
        filePath,
      ) =>
        runSampleOperation(async () => {
          if (!filePath) {
            return {
              error: "File path required for add operation",
              success: false,
            };
          }
          // RE-03: a new sample source must be a file the user gave Romper.
          const access = await checkSampleSourceAccess(
            inMemorySettings,
            filePath,
          );
          if (!access.ok) return { error: access.error, success: false };
          return withEditedKitSamples(
            inMemorySettings,
            kitName,
            sampleService.addSampleToSlot(
              inMemorySettings,
              kitName,
              voiceNumber,
              slotNumber,
              filePath,
            ),
          );
        });
      return add;
    }

    case "delete": {
      const remove: DeleteSampleHandler = (
        _event,
        kitName,
        voiceNumber,
        slotNumber,
      ) =>
        runSampleOperation(async () => {
          // Undo re-adds whatever this edit removes; let it read those files.
          await rememberKitSampleSources(inMemorySettings, kitName);
          const rows = readKitRows(inMemorySettings, kitName);
          return withEditedKitSamples(
            inMemorySettings,
            kitName,
            sampleService.deleteSampleFromSlot(
              inMemorySettings,
              kitName,
              voiceNumber,
              slotNumber,
            ),
            { rows, voices: [voiceNumber] },
          );
        });
      return remove;
    }

    default:
      return () =>
        Promise.resolve({ error: "Unknown operation type", success: false });
  }
}

/**
 * The kit's sample rows now, for a snapshot taken right before an edit.
 * Main runs one IPC handler's synchronous work at a time, so nothing
 * changes them between this read and the edit that follows it.
 */
export function readKitRows(
  inMemorySettings: Record<string, unknown>,
  kitName: string,
): null | Sample[] {
  const { dbDir } = validateAndGetDbDir(inMemorySettings);
  if (!dbDir) return null;
  const rows = getKitSamples(dbDir, kitName);
  return rows.success && rows.data ? rows.data : null;
}

/**
 * Validates local store path and returns database directory
 * (ROMPER_LOCAL_PATH override first, then settings; see ServicePathManager)
 */
export function validateAndGetDbDir(
  inMemorySettings: Record<string, unknown>,
): {
  dbDir?: string;
  error?: string;
  success: boolean;
} {
  const localStorePath = ServicePathManager.getLocalStorePath(inMemorySettings);
  if (!localStorePath) {
    return { error: "No local store path configured", success: false };
  }
  return { dbDir: ServicePathManager.getDbPath(localStorePath), success: true };
}

/**
 * A sample edit's result with the kit as the edit left it and, when
 * `before` holds the rows read right before it, the edited voices as they
 * were (#452)
 */
export function withEditedKitSamples<T extends object>(
  inMemorySettings: Record<string, unknown>,
  kitName: string,
  result: DbResult<T>,
  before?: { rows: null | Sample[]; voices: number[] },
): DbResult<SampleEditKit & T> {
  if (!result.success || !result.data) return result;
  const { dbDir } = validateAndGetDbDir(inMemorySettings);
  const kit = dbDir ? getKit(dbDir, kitName) : null;
  return {
    ...result,
    data: {
      ...result.data,
      ...(kit?.success && kit.data?.samples && { kit: kit.data }),
      ...(before?.rows && {
        voicesBefore: snapshotVoices(before.rows, before.voices),
      }),
    },
  };
}

/** A sample operation's result, or why it failed if it threw */
async function runSampleOperation<T>(
  operation: () => Promise<DbResult<T>>,
): Promise<DbResult<T>> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      error: `Failed to perform sample operation: ${errorMessage}`,
      success: false,
    };
  }
}
