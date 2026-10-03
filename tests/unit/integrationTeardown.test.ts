// The shared integration teardown (tests/integration/support): temp stores
// are deleted only after every database connection is closed, because
// Windows can't delete an open database file.
import { afterEach, describe, expect, it, vi } from "vitest";

const { calls, closeAllDbConnections, rmSync } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    closeAllDbConnections: vi.fn(() => {
      calls.push("close");
    }),
    rmSync: vi.fn((dir: string) => {
      calls.push(`delete ${dir}`);
    }),
  };
});

vi.mock("node:fs", () => ({
  default: {
    mkdtempSync: vi.fn((prefix: string) => `${prefix}abc123`),
    rmSync,
  },
}));
vi.mock("../../electron/main/db/utils/dbConnections.js", () => ({
  closeAllDbConnections,
}));

import {
  closeRegisteredDbConnections,
  registerDbConnectionCloser,
} from "../integration/support/dbConnectionCloser";
import {
  createTempStore,
  removeTempStore,
} from "../integration/support/tempStore";

const CLOSER = Symbol.for("romper.integration.closeAllDbConnections");

afterEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  delete (globalThis as Record<symbol, unknown>)[CLOSER];
});

describe("[Q-07] removeTempStore", () => {
  it("closes every database connection before it deletes the store", () => {
    const store = createTempStore("romper-test-");

    removeTempStore(store);

    expect(calls).toEqual(["close", `delete ${store}`]);
    expect(rmSync).toHaveBeenCalledWith(
      store,
      expect.objectContaining({ force: true, recursive: true }),
    );
  });

  it("does nothing for a store that was never made", () => {
    removeTempStore(undefined);

    expect(calls).toEqual([]);
  });
});

describe("[Q-07] closeRegisteredDbConnections", () => {
  it("calls the closer the integration setup registered", () => {
    registerDbConnectionCloser(closeAllDbConnections);

    closeRegisteredDbConnections();

    expect(closeAllDbConnections).toHaveBeenCalledTimes(1);
  });

  it("throws when no closer is registered, rather than leaving connections open", () => {
    expect(() => closeRegisteredDbConnections()).toThrow(
      /tests\/integration\/support\/setup\.ts/,
    );
  });
});
