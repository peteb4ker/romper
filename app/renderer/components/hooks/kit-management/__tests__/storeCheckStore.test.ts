import type { StoreCheckKitFinding } from "@romper/shared/electronApi";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStoreCheckFinding } from "../../../../../../tests/factories/storeCheck.factory";
import {
  createStoreCheckStore,
  type StoreCheckStore,
  useKitStoreFinding,
  useStoreCheckSummary,
} from "../storeCheckStore";

const finding = (
  kitName: string,
  overrides: Partial<StoreCheckKitFinding> = {},
) => createStoreCheckFinding({ kitName, ...overrides });

describe("[UC-05] [Q-01] storeCheckStore (#824)", () => {
  let store: StoreCheckStore;

  beforeEach(() => {
    store = createStoreCheckStore();
  });

  it("holds each kit's finding, and drops a kit that main says is clean again", () => {
    store.apply([finding("A0", { missing: 2 }), finding("B1", { missing: 1 })]);
    expect(store.getFinding("A0")?.missing).toBe(2);
    expect(store.getSummary().attention.map((kit) => kit.kitName)).toEqual([
      "A0",
      "B1",
    ]);

    store.apply([finding("A0")]);

    expect(store.getFinding("A0")).toBeUndefined();
    expect(store.getSummary().attention.map((kit) => kit.kitName)).toEqual([
      "B1",
    ]);
  });

  it("redraws only the kit whose finding changed", () => {
    const a0 = vi.fn();
    const b1 = vi.fn();
    store.subscribeKit("A0", a0);
    store.subscribeKit("B1", b1);

    store.apply([finding("A0", { missing: 1 })]);

    expect(a0).toHaveBeenCalledTimes(1);
    expect(b1).not.toHaveBeenCalled();
  });

  it("hears nothing of a finding that is the same as the one it holds", () => {
    store.apply([finding("A0", { missing: 1 })]);
    const any = vi.fn();
    const a0 = vi.fn();
    store.subscribe(any);
    store.subscribeKit("A0", a0);

    store.apply([finding("A0", { missing: 1 })]);

    expect(any).not.toHaveBeenCalled();
    expect(a0).not.toHaveBeenCalled();
  });

  it("gives the same summary until a finding changes", () => {
    store.apply([finding("A0", { missing: 1 })]);
    const summary = store.getSummary();
    expect(store.getSummary()).toBe(summary);

    store.apply([finding("A0", { missing: 2 })]);
    expect(store.getSummary()).not.toBe(summary);
  });

  it("stops telling a listener once it unsubscribes", () => {
    const a0 = vi.fn();
    const stop = store.subscribeKit("A0", a0);
    stop();

    store.apply([finding("A0", { missing: 1 })]);

    expect(a0).not.toHaveBeenCalled();
  });

  it("replaces everything with the status main holds: a kit it no longer lists is clean", () => {
    store.apply([finding("A0", { missing: 1 }), finding("B1", { missing: 1 })]);
    const a0 = vi.fn();
    store.subscribeKit("A0", a0);

    store.replace([
      finding("B1", { missing: 1 }),
      finding("C2", { untracked: ["x"] }),
    ]);

    expect(store.getFinding("A0")).toBeUndefined();
    expect(a0).toHaveBeenCalledTimes(1);
    expect(store.getSummary().attention.map((kit) => kit.kitName)).toEqual([
      "B1",
      "C2",
    ]);
  });

  describe("which problems are new", () => {
    it("counts the kits whose missing files weren't known, once", () => {
      store.apply([
        finding("A0", { missing: 1 }),
        finding("B1", { missing: 3 }),
      ]);

      expect(store.takeNewMissing()).toBe(2);
      expect(store.takeNewMissing()).toBe(0);
    });

    it("doesn't count a problem it already announced when a later pass finds it again", () => {
      store.apply([finding("A0", { missing: 1 })]);
      store.takeNewMissing();

      store.apply([finding("A0", { missing: 1 })]);
      store.replace([finding("A0", { missing: 1 })]);

      expect(store.takeNewMissing()).toBe(0);
    });

    it("counts a kit again when it has more missing files than before", () => {
      store.apply([finding("A0", { missing: 1 })]);
      store.takeNewMissing();

      store.apply([finding("A0", { missing: 2 })]);

      expect(store.takeNewMissing()).toBe(1);
    });

    it("counts a kit again when its problem came back after it was fixed", () => {
      store.apply([finding("A0", { missing: 1 })]);
      store.takeNewMissing();
      store.apply([finding("A0")]);

      store.apply([finding("A0", { missing: 1 })]);

      expect(store.takeNewMissing()).toBe(1);
    });

    it("doesn't count fewer missing files, a kit's folder, untracked files or an unreadable file", () => {
      store.apply([finding("A0", { missing: 3 })]);
      store.takeNewMissing();

      store.apply([
        finding("A0", { missing: 1 }),
        finding("B1", { untracked: ["x"] }),
        finding("C2", { folderMissing: true }),
        finding("D3", { quarantined: true, unreadable: 1 }),
      ]);

      expect(store.takeNewMissing()).toBe(0);
    });

    it("drops a kit from the count when its files are back before the message", () => {
      store.apply([finding("A0", { missing: 1 })]);

      store.apply([finding("A0")]);

      expect(store.takeNewMissing()).toBe(0);
    });
  });

  it("forgets everything for another store, including what it announced", () => {
    store.begin("/one");
    store.apply([finding("A0", { missing: 1 })]);
    store.takeNewMissing();

    store.begin("/one");
    expect(store.getFinding("A0")).toBeDefined();

    store.begin("/two");
    expect(store.getFinding("A0")).toBeUndefined();
    store.apply([finding("A0", { missing: 1 })]);
    expect(store.takeNewMissing()).toBe(1);
  });

  it("opens and closes the dialog, and closes it for another store", () => {
    const any = vi.fn();
    store.subscribe(any);

    store.openDialog();
    store.openDialog();
    expect(store.getDialogOpen()).toBe(true);
    expect(any).toHaveBeenCalledTimes(1);

    store.closeDialog();
    expect(store.getDialogOpen()).toBe(false);

    store.openDialog();
    store.begin("/other");
    expect(store.getDialogOpen()).toBe(false);
  });

  describe("hooks", () => {
    it("redraw a component when its kit's finding changes", () => {
      const { result } = renderHook(() => useKitStoreFinding("A0", store));
      expect(result.current).toBeUndefined();

      act(() => store.apply([finding("A0", { missing: 1 })]));

      expect(result.current?.missing).toBe(1);
    });

    it("redraw the notice when the summary changes", () => {
      const { result } = renderHook(() => useStoreCheckSummary(store));
      expect(result.current.attention).toEqual([]);

      act(() => store.apply([finding("A0", { missing: 1 })]));

      expect(result.current.attention).toHaveLength(1);
    });
  });
});
