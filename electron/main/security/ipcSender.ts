import type { IpcMain, IpcMainInvokeEvent } from "electron";

import {
  type AppNavigationTarget,
  isAllowedAppNavigation,
} from "../navigationPolicy.js";

/**
 * IPC sender validation (the IPC half of RE-02).
 *
 * Every `ipcMain.handle` listener is wrapped so it only runs for messages
 * from the app's own renderer page, in the top-level frame. "The app's own
 * page" is the same test the window's navigation guard uses
 * (`isAllowedAppNavigation`): the Vite dev server origin in development,
 * exactly the bundled `index.html` otherwise (hash route and query ignored).
 *
 * Anything else (another local file the window was navigated to, a subframe,
 * a destroyed frame) is rejected before the handler sees its arguments.
 */

type Handler = Parameters<IpcMain["handle"]>[1];

type IpcMainLike = Pick<IpcMain, "handle">;

interface SenderEventLike {
  senderFrame?: null | SenderFrameLike;
}

interface SenderFrameLike {
  parent?: unknown;
  url?: string;
}

const ENFORCED = Symbol.for("romper.ipcSenderValidation");

export class UntrustedIpcSenderError extends Error {
  constructor(channel: string) {
    super(`Blocked "${channel}": IPC is only accepted from the Romper window`);
    this.name = "UntrustedIpcSenderError";
  }
}

/**
 * Wrap every handler registered on `ipc` from now on with sender validation.
 * Call once, before any handler is registered. Idempotent.
 */
export function enforceTrustedIpcSenders(
  ipc: IpcMainLike,
  appTarget: AppNavigationTarget,
): void {
  const marked = ipc as { [ENFORCED]?: boolean } & IpcMainLike;
  if (marked[ENFORCED]) return;
  const register = ipc.handle.bind(ipc);
  ipc.handle = (channel, listener) =>
    register(channel, withTrustedSender(channel, listener, appTarget));
  marked[ENFORCED] = true;
}

/** True if the event came from the app's own page in the top-level frame. */
export function isTrustedIpcSender(
  event: SenderEventLike | undefined,
  appTarget: AppNavigationTarget,
): boolean {
  const frame = event?.senderFrame;
  if (!frame || typeof frame.url !== "string") return false;
  // WebFrameMain.parent is null for the top-level frame.
  if (frame.parent !== null && frame.parent !== undefined) return false;
  return isAllowedAppNavigation(frame.url, appTarget);
}

/** Wrap one handler with sender validation; keeps sync handlers sync. */
export function withTrustedSender(
  channel: string,
  handler: Handler,
  appTarget: AppNavigationTarget,
): Handler {
  return (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!isTrustedIpcSender(event, appTarget)) {
      console.warn(
        `[IPC] Rejected "${channel}" from untrusted sender:`,
        event?.senderFrame?.url ?? "(no frame)",
      );
      throw new UntrustedIpcSenderError(channel);
    }
    return handler(event, ...args);
  };
}
