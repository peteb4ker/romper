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

  it("groups the kits under the heading for what is wrong, in slot order, with each kit's lines", () => {
    render(<LibraryCheckDialog />);
    find(
      { kitName: "B1", untracked: ["2 a.wav", "2 b.wav"] },
      { kitName: "A10", missing: 1 },
      { kitName: "A2", missing: 2, untracked: ["3 c.wav"] },
      { folderMissing: true, kitName: "C3", missing: 4 },
      { kitName: "D4", quarantined: true, unreadable: 1 },
    );
    open();

    const missing = screen.getByTestId("library-check-group-missing");
    expect(
      within(missing).getByRole("heading", { name: "Sample files not found" }),
    ).toBeInTheDocument();
    const missingKits = [...missing.querySelectorAll(":scope > ul > li")];
    expect(missingKits.map((kit) => kit.getAttribute("data-testid"))).toEqual([
      "library-check-missing-A2",
      "library-check-missing-A10",
      "library-check-missing-C3",
    ]);
    expect(
      within(screen.getByTestId("library-check-missing-A2")).getByText(
        "2 sample files not found",
      ),
    ).toBeInTheDocument();
    // A kit with no folder reads its folder line too
    const c3 = within(screen.getByTestId("library-check-missing-C3"));
    expect(c3.getByText("4 sample files not found")).toBeInTheDocument();
    expect(
      c3.getByText("C3's folder is missing from your library."),
    ).toBeInTheDocument();

    const untracked = screen.getByTestId("library-check-group-untracked");
    expect(
      within(untracked).getByRole("heading", { name: "Files not in the kit" }),
    ).toBeInTheDocument();
    const untrackedKits = [...untracked.querySelectorAll(":scope > ul > li")];
    expect(untrackedKits.map((kit) => kit.getAttribute("data-testid"))).toEqual(
      ["library-check-untracked-A2", "library-check-untracked-B1"],
    );
    expect(
      within(screen.getByTestId("library-check-untracked-A2")).getByText(
        "1 file in this kit's folder isn't in the kit. Scan the kit to add it.",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("library-check-untracked-B1")).getByText(
        "2 files in this kit's folder aren't in the kit. Scan the kit to add them.",
      ),
    ).toBeInTheDocument();
    // Only the quarantine icon covers a kit with a file that can't be read
    expect(screen.queryByText("D4")).toBeNull();
  });

  it("shows a heading only when a kit is under it", () => {
    render(<LibraryCheckDialog />);
    find({ kitName: "A0", missing: 1 });
    open();

    expect(
      screen.getByRole("heading", { name: "Sample files not found" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Files not in the kit" }),
    ).toBeNull();
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
    // None of them is a kit to look at, and the dialog isn't empty
    expect(screen.queryByTestId("library-check-group-missing")).toBeNull();
    expect(screen.queryByTestId("library-check-group-untracked")).toBeNull();
    expect(screen.queryByText("No problems found.")).toBeNull();
  });

  it("follows the check while it's open: a kit drops off when its files are back", () => {
    render(<LibraryCheckDialog />);
    find({ kitName: "A0", missing: 1 }, { kitName: "B1", missing: 1 });
    open();

    find({ kitName: "A0" });

    expect(screen.queryByTestId("library-check-missing-A0")).toBeNull();
    expect(screen.getByTestId("library-check-missing-B1")).toBeInTheDocument();
  });

  it("says no problems were found when the list empties while it's open", () => {
    render(<LibraryCheckDialog />);
    find({ kitName: "A0", missing: 1 });
    open();
    expect(screen.queryByText("No problems found.")).toBeNull();

    find({ kitName: "A0" });

    expect(screen.getByText("No problems found.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sample files not found" }),
    ).toBeNull();
    // Still a dialog, and it still closes
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
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
