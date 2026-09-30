import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppNavigationTarget } from "../../navigationPolicy";

import {
  enforceTrustedIpcSenders,
  isTrustedIpcSender,
  UntrustedIpcSenderError,
  withTrustedSender,
} from "../ipcSender";

const INDEX = path.resolve("/app/dist/renderer/index.html");
const INDEX_URL = pathToFileURL(INDEX).href;
const PROD: AppNavigationTarget = { indexPath: INDEX, kind: "file" };
const DEV: AppNavigationTarget = {
  devServerOrigin: "http://localhost:5173",
  kind: "dev",
};

function eventFrom(url: null | string, parent: unknown = null) {
  return {
    senderFrame: url === null ? null : { parent, url },
  } as never;
}

describe("ipcSender (RE-02 IPC half)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isTrustedIpcSender", () => {
    // Which URLs count as the app's page is navigationPolicy's job (and its
    // tests'); these cover the frame checks and that the policy is applied.
    it("accepts the app page in the top-level frame", () => {
      expect(isTrustedIpcSender(eventFrom(INDEX_URL), PROD)).toBe(true);
      expect(isTrustedIpcSender(eventFrom(`${INDEX_URL}#/kits/A0`), PROD)).toBe(
        true,
      );
      expect(
        isTrustedIpcSender(eventFrom("http://localhost:5173/#/kits"), DEV),
      ).toBe(true);
    });

    it("rejects any other page", () => {
      const other = pathToFileURL("/Users/me/Downloads/evil.html").href;
      expect(isTrustedIpcSender(eventFrom(other), PROD)).toBe(false);
      expect(isTrustedIpcSender(eventFrom("http://localhost:5174/"), DEV)).toBe(
        false,
      );
      expect(isTrustedIpcSender(eventFrom(INDEX_URL), DEV)).toBe(false);
    });

    it("rejects subframes, missing frames and missing events", () => {
      expect(isTrustedIpcSender(eventFrom(INDEX_URL, {}), PROD)).toBe(false);
      expect(isTrustedIpcSender(eventFrom(null), PROD)).toBe(false);
      expect(isTrustedIpcSender(undefined, PROD)).toBe(false);
    });
  });

  describe("withTrustedSender", () => {
    it("passes a trusted call through and keeps sync handlers sync", () => {
      const handler = vi.fn((_event: unknown, a: number, b: number) => a + b);
      const guarded = withTrustedSender("add", handler as never, PROD);
      const event = eventFrom(INDEX_URL);
      expect(guarded(event, 2, 3)).toBe(5);
      expect(handler).toHaveBeenCalledWith(event, 2, 3);
    });

    it("throws before the handler sees an untrusted call", () => {
      const handler = vi.fn();
      const guarded = withTrustedSender("read-file", handler as never, PROD);
      const evil = eventFrom(pathToFileURL("/tmp/evil.html").href);
      expect(() => guarded(evil, "/etc/passwd")).toThrow(
        UntrustedIpcSenderError,
      );
      expect(handler).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe("enforceTrustedIpcSenders", () => {
    it("wraps every handler registered afterwards", async () => {
      const registered = new Map<string, (...args: unknown[]) => unknown>();
      const ipc = {
        handle: vi.fn((channel: string, listener: never) => {
          registered.set(channel, listener);
        }),
      };

      enforceTrustedIpcSenders(ipc as never, PROD);
      const handler = vi.fn(async () => "ok");
      ipc.handle("ensure-dir", handler as never);

      const listener = registered.get("ensure-dir")!;
      await expect(listener(eventFrom(INDEX_URL), "/x")).resolves.toBe("ok");
      expect(() => listener(eventFrom("file:///tmp/evil.html"), "/x")).toThrow(
        /only accepted from the Romper window/,
      );
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("is idempotent", () => {
      const registered = new Map<string, (...args: unknown[]) => unknown>();
      const ipc = {
        handle: vi.fn((channel: string, listener: never) => {
          registered.set(channel, listener);
        }),
      };
      enforceTrustedIpcSenders(ipc as never, PROD);
      enforceTrustedIpcSenders(ipc as never, DEV); // ignored
      const handler = vi.fn(() => "ok");
      ipc.handle("x", handler as never);
      expect(registered.get("x")!(eventFrom(INDEX_URL))).toBe("ok");
    });
  });
});
