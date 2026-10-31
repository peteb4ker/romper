import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStoreCheckFinding } from "../../../../../tests/factories/storeCheck.factory";
import { createMockSettings } from "../../../../../tests/mocks/settings";
import { storeCheckStore } from "../../hooks/kit-management/storeCheckStore";
import StatusBar from "../../StatusBar";
import LibraryCheckDialog from "../LibraryCheckDialog";

vi.mock("../../../utils/SettingsContext", () => ({
  useSettings: () =>
    createMockSettings({
      isDarkMode: false,
      localStorePath: "/store",
      themeMode: "light",
    }),
}));

vi.mock("../../hooks/shared/usePreferenceSaves", () => ({
  usePreferenceSaves: () => ({ saveThemeMode: vi.fn() }),
}));

const find = (...kits: Parameters<typeof createStoreCheckFinding>[0][]) => {
  act(() =>
    storeCheckStore.apply(kits.map((kit) => createStoreCheckFinding(kit))),
  );
};

const open = () => act(() => storeCheckStore.openDialog());

describe("[UC-05] [Q-06] LibraryCheckDialog (#824)", () => {
  beforeEach(() => {
    storeCheckStore.reset();
  });

  it("renders nothing until it's opened", () => {
    render(<LibraryCheckDialog />);
    find({ kitName: "A0", missing: 1 });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a labelled modal dialog titled Library check", () => {
    render(<LibraryCheckDialog />);
    find({ kitName: "A0", missing: 1 });
    open();

    const dialog = screen.getByRole("dialog", { name: "Library check" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("lists each kit that needs attention, in slot order, with what is wrong", () => {
    render(<LibraryCheckDialog />);
    find(
      { kitName: "B1", untracked: ["2 a.wav", "2 b.wav"] },
      { kitName: "A10", missing: 1 },
      { kitName: "A2", missing: 2, untracked: ["3 c.wav"] },
      { folderMissing: true, kitName: "C3", missing: 4 },
      { kitName: "D4", quarantined: true, unreadable: 1 },
    );
    open();

    const items = screen
      .getByTestId("library-check-kits")
      .querySelectorAll(":scope > li");
    expect([...items].map((item) => item.getAttribute("data-testid"))).toEqual([
      "library-check-kit-A2",
      "library-check-kit-A10",
      "library-check-kit-B1",
      "library-check-kit-C3",
    ]);
    const a2 = within(screen.getByTestId("library-check-kit-A2"));
    expect(a2.getByText("2 sample files not found")).toBeInTheDocument();
    expect(
      a2.getByText(
        "1 file in this kit's folder isn't in the kit. Scan the kit to add it.",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("library-check-kit-B1")).getByText(
        "2 files in this kit's folder aren't in the kit. Scan the kit to add them.",
      ),
    ).toBeInTheDocument();
    const c3 = within(screen.getByTestId("library-check-kit-C3"));
    expect(
      c3.getByText("C3's folder is missing from your library."),
    ).toBeInTheDocument();
  });

  it("has a line for each drive that isn't connected, totalled over kits, and each that didn't respond", () => {
    render(<LibraryCheckDialog />);
    find(
      {
        kitName: "A0",
        notConnected: [{ samples: 10, volume: "/Volumes/Samples SSD" }],
      },
      {
        kitName: "A1",
        notConnected: [{ samples: 4, volume: "/Volumes/Samples SSD" }],
        notResponding: ["/Volumes/Slow"],
      },
      {
        kitName: "A2",
        notConnected: [{ samples: 6, volume: "/Volumes/Samples SSD" }],
      },
    );
    open();

    const drives = within(screen.getByTestId("library-check-drives"));
    expect(
      drives.getByText(
        `The drive "Samples SSD" isn't connected, so 20 samples in 3 kits weren't checked.`,
      ),
    ).toBeInTheDocument();
    expect(
      drives.getByText(
        `The drive "Slow" didn't respond, so some samples weren't checked.`,
      ),
    ).toBeInTheDocument();
    // None of them is a kit to look at
    expect(screen.queryByTestId("library-check-kits")).toBeNull();
  });

  it("follows the check while it's open: a kit drops off when its files are back", () => {
    render(<LibraryCheckDialog />);
    find({ kitName: "A0", missing: 1 }, { kitName: "B1", missing: 1 });
    open();

    find({ kitName: "A0" });

    expect(screen.queryByTestId("library-check-kit-A0")).toBeNull();
    expect(screen.getByTestId("library-check-kit-B1")).toBeInTheDocument();
  });

  it("closes with the Close button", () => {
    render(<LibraryCheckDialog />);
    find({ kitName: "A0", missing: 1 });
    open();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(storeCheckStore.getDialogOpen()).toBe(false);
  });

  it("closes with Escape", () => {
    render(<LibraryCheckDialog />);
    find({ kitName: "A0", missing: 1 });
    open();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  describe("from the status bar item", () => {
    it("opens with the item, keeps focus inside, and gives focus back to the item when it closes", () => {
      render(
        <>
          <StatusBar />
          <LibraryCheckDialog />
        </>,
      );
      find({ kitName: "A0", missing: 1 });
      const item = screen.getByRole("button", {
        name: "1 kit needs attention",
      });
      item.focus();

      fireEvent.click(item);
      const dialog = screen.getByRole("dialog", { name: "Library check" });
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Tab wraps inside the dialog
      const close = within(dialog).getByRole("button", { name: "Close" });
      close.focus();
      fireEvent.keyDown(document, { key: "Tab" });
      expect(dialog.contains(document.activeElement)).toBe(true);

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(item).toHaveFocus();
    });
  });
});
