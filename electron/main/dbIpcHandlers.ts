// DB-related IPC handlers for Romper (modular, testable)
import { ipcMain } from "electron";

import {
  createRomperDbFile,
  insertKitRecord,
  insertSampleRecord,
} from "./db/romperDbCore.js";

export function registerDbIpcHandlers() {
  ipcMain.handle("create-romper-db", async (_event, dbDir: string) => {
    return createRomperDbFile(dbDir);
  });

  ipcMain.handle(
    "insert-kit",
    async (
      _event,
      dbDir: string,
      kit: {
        name: string;
        alias?: string;
        artist?: string;
        plan_enabled: boolean;
      },
    ) => {
      return insertKitRecord(dbDir, kit);
    },
  );

  ipcMain.handle(
    "insert-sample",
    async (
      _event,
      dbDir: string,
      sample: {
        kit_id: number;
        filename: string;
        slot_number: number;
        is_stereo: boolean;
      },
    ) => {
      return insertSampleRecord(dbDir, sample);
    },
  );
}
