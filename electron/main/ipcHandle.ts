import type {
  IpcArgs,
  IpcChannel,
  IpcEvents,
  IpcResult,
} from "@romper/shared/ipcChannels.js";
import type { IpcMainInvokeEvent } from "electron";

import { ipcMain } from "electron";

/**
 * A handler for `channel`: it takes the arguments the contract says the
 * preload sends (or wider types, to validate them) and resolves with the
 * channel's result. An `event` it doesn't use may be typed `unknown`.
 */
export type IpcHandler<C extends IpcChannel> = (
  event: IpcMainInvokeEvent,
  ...args: IpcArgs<C>
) => IpcResult<C> | Promise<IpcResult<C>>;

/**
 * Something main can send an event to: a window's webContents, or the
 * sender of an invoke.
 */
interface EventTarget {
  send: (channel: string, ...args: unknown[]) => void;
}

/**
 * Register the handler for an IPC channel (#472). Every handler in main is
 * registered through this, never with `ipcMain.handle` directly, so its
 * arguments and result are checked against the ElectronAPI contract
 * (shared/ipcChannels.ts) at compile time. Registration still goes through
 * `ipcMain.handle`, so sender validation (RE-02) wraps it.
 */
export function handle<C extends IpcChannel>(
  channel: C,
  handler: IpcHandler<C>,
): void {
  ipcMain.handle(channel, handler);
}

/** Send the renderer an event the contract describes (IpcEvents) */
export function sendEvent<E extends keyof IpcEvents>(
  target: EventTarget,
  channel: E,
  ...payload: IpcEvents[E] extends void ? [] : [IpcEvents[E]]
): void {
  target.send(channel, ...payload);
}
