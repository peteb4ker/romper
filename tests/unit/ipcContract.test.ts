import type { DbResult, KitWithRelations } from "@romper/shared/db/schema";
import type { ElectronAPI, SyncProgress } from "@romper/shared/electronApi";
import type {
  IpcArgs,
  IpcResult,
  MethodWithChannel,
} from "@romper/shared/ipcChannels";
import type { IpcMainInvokeEvent } from "electron";

import { describe, expectTypeOf, it } from "vitest";

import type { SyncProgressState } from "../../app/renderer/components/dialogs/SyncUpdateDialog.types";
import type { IpcHandler } from "../../electron/main/ipcHandle";

/**
 * Type-level checks on the IPC contract (#472). They run in `npm run
 * typecheck` (tsconfig.test.json); at runtime each `expectTypeOf` is a
 * no-op. A handler that drifts from the contract stops compiling, which is
 * what these pin down.
 */
describe("[Q-07] IPC contract types", () => {
  it("gives every ElectronAPI method except the event listeners a channel", () => {
    expectTypeOf<Exclude<keyof ElectronAPI, MethodWithChannel>>().toEqualTypeOf<
      "onLocalStoreDatabaseMissing" | "onStoreCheckUpdated" | "onSyncProgress"
    >();
  });

  it("carries a method's own arguments and result over its channel", () => {
    expectTypeOf<IpcArgs<"get-kit">>().toEqualTypeOf<
      Parameters<ElectronAPI["getKit"]>
    >();
    expectTypeOf<IpcResult<"get-kit">>().toEqualTypeOf<
      DbResult<KitWithRelations>
    >();
  });

  it("accepts a handler that matches the contract", () => {
    expectTypeOf<
      (
        event: IpcMainInvokeEvent,
        kitName: string,
      ) => Promise<DbResult<KitWithRelations>>
    >().toExtend<IpcHandler<"get-kit">>();
    // A handler may take wider arguments, to validate them itself
    expectTypeOf<
      (event: unknown, kitName: unknown) => DbResult<KitWithRelations>
    >().toExtend<IpcHandler<"get-kit">>();
  });

  it("rejects a handler whose result drifts from the contract", () => {
    // The drift #472 found: a missing kit as success with null data
    expectTypeOf<
      (
        event: IpcMainInvokeEvent,
        kitName: string,
      ) => DbResult<KitWithRelations | null>
    >().not.toExtend<IpcHandler<"get-kit">>();
    // null where the contract says undefined
    expectTypeOf<
      (event: IpcMainInvokeEvent) => Promise<null | string>
    >().not.toExtend<IpcHandler<"select-local-store-path">>();
  });

  it("rejects a handler whose arguments drift from the contract", () => {
    expectTypeOf<
      (event: IpcMainInvokeEvent, kitName: number) => DbResult<KitWithRelations>
    >().not.toExtend<IpcHandler<"get-kit">>();
    // One argument more than the preload sends
    expectTypeOf<
      (
        event: IpcMainInvokeEvent,
        kitName: string,
        extra: string,
      ) => DbResult<KitWithRelations>
    >().not.toExtend<IpcHandler<"get-kit">>();
  });

  it("has one sync progress event shape, which the write panel's state extends", () => {
    expectTypeOf<SyncProgress["status"]>().toExtend<
      SyncProgressState["status"]
    >();
    expectTypeOf<SyncProgress>().toExtend<SyncProgressState>();
  });
});
