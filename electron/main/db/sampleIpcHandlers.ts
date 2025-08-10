import { ipcMain } from "electron";

import { sampleService } from "../services/sampleService.js";
import { createSampleOperationHandler } from "./ipcHandlerUtils.js";

/**
 * Registers all sample-related IPC handlers
 */
export function registerSampleIpcHandlers(
  inMemorySettings: Record<string, any>,
) {
  ipcMain.handle(
    "add-sample-to-slot",
    createSampleOperationHandler(inMemorySettings, "add"),
  );

  ipcMain.handle(
    "replace-sample-in-slot",
    createSampleOperationHandler(inMemorySettings, "replace"),
  );

  ipcMain.handle(
    "delete-sample-from-slot",
    createSampleOperationHandler(inMemorySettings, "delete"),
  );

  ipcMain.handle(
    "delete-sample-from-slot-without-reindexing",
    async (_event, kitName: string, voiceNumber: number, slotIndex: number) => {
      return sampleService.deleteSampleFromSlotWithoutReindexing(
        inMemorySettings,
        kitName,
        voiceNumber,
        slotIndex,
      );
    },
  );

  ipcMain.handle(
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
        const result = sampleService.moveSampleInKit(
          inMemorySettings,
          kitName,
          fromVoice,
          fromSlot,
          toVoice,
          toSlot,
          "insert",
        );
        return result;
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

  ipcMain.handle(
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

  ipcMain.handle("validate-sample-sources", async (_event, kitName: string) => {
    return sampleService.validateSampleSources(inMemorySettings, kitName);
  });
}
