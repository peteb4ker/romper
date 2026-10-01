import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSyncProgressStore } from "../../hooks/shared/syncProgressStore";
import LiveSyncUpdateDialog from "../LiveSyncUpdateDialog";

describe("LiveSyncUpdateDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows progress from the store as it changes", () => {
    const store = createSyncProgressStore();
    render(
      <LiveSyncUpdateDialog
        isOpen={true}
        kitName="All Kits"
        localChangeSummary={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        sdCardPath="/sd"
        syncProgressStore={store}
      />,
    );

    act(() =>
      store.set({
        bytesCompleted: 0,
        currentFile: "kick.wav",
        currentKitName: "A0",
        filesCompleted: 1,
        status: "copying",
        totalBytes: 0,
        totalFiles: 2395,
      }),
    );
    expect(screen.getByText("1/2395")).toBeInTheDocument();

    act(() =>
      store.set((prev) => (prev ? { ...prev, filesCompleted: 1200 } : null)),
    );
    expect(screen.getByText("1200/2395")).toBeInTheDocument();
  });
});
