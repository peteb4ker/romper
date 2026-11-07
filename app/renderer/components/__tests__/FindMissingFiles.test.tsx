import type {
  FindMissingFilesResult,
  FoundFile,
} from "@romper/shared/electronApi";

import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FindMissingFiles from "../FindMissingFiles";

const pick = () => vi.mocked(globalThis.electronAPI.pickSearchFolder);
const search = () => vi.mocked(globalThis.electronAPI.findMissingFiles);
const restore = () => vi.mocked(globalThis.electronAPI.restoreMissingFile);
const cancel = () => vi.mocked(globalThis.electronAPI.cancelFindMissingFiles);

const file = (overrides: Partial<FoundFile> = {}): FoundFile => ({
  match: true,
  mtimeMs: Date.UTC(2026, 9, 3),
  path: "/Users/me/Samples/Drums/kick.wav",
  size: 120 * 1024,
  where: "Samples/Drums",
  ...overrides,
});

const results = (
  found: FoundFile[],
  overrides: Partial<FindMissingFilesResult> = {},
): FindMissingFilesResult => ({
  cancelled: false,
  files: [{ fileName: "kick.wav", found, inStore: true, sampleId: 7 }],
  folderName: "Samples",
  incomplete: null,
  ...overrides,
});

function renderFind(
  props: Partial<React.ComponentProps<typeof FindMissingFiles>> = {},
) {
  const onError = vi.fn();
  const onBusyChange = vi.fn();
  const view = render(
    <FindMissingFiles
      data-testid="find"
      disabled={false}
      kitName="A3"
      onBusyChange={onBusyChange}
      onError={onError}
      {...props}
    >
      {({ button, results: list }) => (
        <div>
          {button}
          {list}
        </div>
      )}
    </FindMissingFiles>,
  );
  return { ...view, onBusyChange, onError };
}

const press = async () => {
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Find missing files… A3" }),
    );
  });
};

describe("[UC-05] [Q-06] FindMissingFiles (#823, stage 6)", () => {
  beforeEach(() => {
    pick().mockResolvedValue({ data: "/Users/me/Samples", success: true });
    search().mockResolvedValue({ data: results([file()]), success: true });
    restore().mockResolvedValue({
      data: {
        changed: false,
        restored: {
          fileName: "kick.wav",
          foundPath: file().path,
          kind: "copy",
          path: "/store/A3/kick.wav",
          sampleId: 7,
        },
      },
      success: true,
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("is a button named for the kit, labelled Find missing files…", () => {
    renderFind();
    expect(screen.getByTestId("find")).toHaveTextContent("Find missing files…");
    expect(screen.getByTestId("find")).toHaveAccessibleName(
      "Find missing files… A3",
    );
  });

  it("asks main for a folder, searches it, and offers the one match with Copy back", async () => {
    renderFind();
    await press();

    expect(pick()).toHaveBeenCalledWith("A3");
    expect(search()).toHaveBeenCalledWith("A3", "/Users/me/Samples");
    expect(
      screen.getByText("Found kick.wav in Samples/Drums."),
    ).toBeInTheDocument();
    const copy = screen.getByRole("button", { name: "Copy back" });
    expect(copy).toHaveAccessibleDescription(
      "Found kick.wav in Samples/Drums.",
    );
  });

  it("offers Use this file for a sample outside the store (D2)", async () => {
    search().mockResolvedValue({
      data: {
        ...results([file()]),
        files: [
          {
            fileName: "kick.wav",
            found: [file()],
            inStore: false,
            sampleId: 7,
          },
        ],
      },
      success: true,
    });
    renderFind();
    await press();

    expect(
      screen.getByRole("button", { name: "Use this file" }),
    ).toBeInTheDocument();
  });

  it("does nothing more when the dialog is cancelled", async () => {
    pick().mockResolvedValue({ data: null, success: true });
    const { onBusyChange } = renderFind();
    await press();

    expect(search()).not.toHaveBeenCalled();
    expect(screen.getByTestId("find-results")).toBeEmptyDOMElement();
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it("says when nothing was found, naming the folder", async () => {
    search().mockResolvedValue({ data: results([]), success: true });
    renderFind();
    await press();

    expect(
      screen.getByText("No copy of kick.wav found in Samples."),
    ).toBeInTheDocument();
  });

  it("lists several files for the user to choose, with where, size and date, and marks a possible match (D3)", async () => {
    search().mockResolvedValue({
      data: results([
        file(),
        file({
          path: "/Users/me/Samples/Kits/kick.wav",
          where: "Samples/Kits",
        }),
        file({
          match: false,
          path: "/Users/me/Samples/Old/kick.wav",
          where: "Samples/Old",
        }),
      ]),
      success: true,
    });
    renderFind();
    await press();

    expect(
      screen.getByText("Found 3 files named kick.wav. Choose one."),
    ).toBeInTheDocument();
    const second = screen.getByTestId("find-file-7-choice-2");
    expect(second).toHaveTextContent("Samples/Old/kick.wav");
    expect(second).toHaveTextContent("120");
    expect(second).toHaveTextContent("Different size or format");
    expect(screen.getByTestId("find-file-7-choice-0")).not.toHaveTextContent(
      "Different size or format",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("find-file-7-choice-2-restore"));
    });
    expect(restore()).toHaveBeenCalledWith("A3", {
      foundPath: "/Users/me/Samples/Old/kick.wav",
      kind: "restore",
      sampleId: 7,
    });
  });

  it("offers the one match by itself when the others only share its name", async () => {
    search().mockResolvedValue({
      data: results([
        file(),
        file({ match: false, path: "/x/kick.wav", where: "x" }),
      ]),
      success: true,
    });
    renderFind();
    await press();

    expect(
      screen.getByText("Found kick.wav in Samples/Drums."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Copy back" })).toHaveLength(
      1,
    );
  });

  it("names a lone possible match as one", async () => {
    search().mockResolvedValue({
      data: results([file({ match: false })]),
      success: true,
    });
    renderFind();
    await press();

    expect(
      screen.getByText(
        "Found a file named kick.wav in Samples/Drums, but its size or format is different.",
      ),
    ).toBeInTheDocument();
  });

  it("says when the search didn't look everywhere", async () => {
    search().mockResolvedValue({
      data: results([], { incomplete: "limit" }),
      success: true,
    });
    renderFind();
    await press();

    expect(
      screen.getByText(
        "Samples has too many files to search them all. Choose a folder inside it.",
      ),
    ).toBeInTheDocument();
  });

  it("copies back, puts one undo entry for the kit on the stack, and drops the file from the list", async () => {
    const added = vi.fn();
    const onAdd = (e: Event) => added((e as CustomEvent).detail);
    document.addEventListener("romper:add-undo-action", onAdd);
    try {
      renderFind();
      await press();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy back" }));
      });

      expect(added).toHaveBeenCalledTimes(1);
      expect(added.mock.calls[0][0]).toMatchObject({
        data: { kitName: "A3", restored: { kind: "copy", sampleId: 7 } },
        description: "Copy back kick.wav",
        type: "RESTORE_MISSING_FILE",
      });
      expect(screen.queryByText("Found kick.wav in Samples/Drums.")).toBeNull();
    } finally {
      document.removeEventListener("romper:add-undo-action", onAdd);
    }
  });

  it("shows main's words when a restore fails, and keeps the file listed", async () => {
    restore().mockResolvedValue({
      error: "Kit A3 isn't editable.",
      success: false,
    });
    const { onError } = renderFind();
    await press();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy back" }));
    });

    expect(onError).toHaveBeenCalledWith("Kit A3 isn't editable.");
    expect(
      screen.getByText("Found kick.wav in Samples/Drums."),
    ).toBeInTheDocument();
  });

  it("shows main's words when the search fails", async () => {
    search().mockResolvedValue({ error: "Kit A3 not found", success: false });
    const { onError } = renderFind();
    await press();

    expect(onError).toHaveBeenCalledWith("Kit A3 not found");
  });

  it("is busy while it searches, with a Cancel button that stops the search", async () => {
    let finish: (
      value: Awaited<ReturnType<ReturnType<typeof search>>>,
    ) => void = () => undefined;
    search().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { onBusyChange } = renderFind();
    await press();

    const button = screen.getByTestId("find");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(pick()).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel()).toHaveBeenCalled();

    await act(async () => {
      finish({ data: results([], { cancelled: true }), success: true });
    });
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.getByTestId("find-results")).toBeEmptyDOMElement();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("stops a search still running when it goes away", async () => {
    search().mockReturnValue(new Promise(() => undefined));
    const { unmount } = renderFind();
    await press();
    unmount();

    expect(cancel()).toHaveBeenCalled();
  });

  it("does nothing while another fix runs", async () => {
    renderFind({ disabled: true });
    await press();

    expect(pick()).not.toHaveBeenCalled();
    expect(screen.getByTestId("find")).toHaveAttribute("aria-disabled", "true");
  });

  it("announces its results politely", () => {
    renderFind();
    expect(screen.getByTestId("find-results")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});
