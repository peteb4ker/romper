import type { DbResult, KitWithRelations } from "@romper/shared/db/schema";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import KitEditor from "../KitEditor";

// The header and the editor's logic are real; the panels below the header
// aren't part of the favorite path, so they're stubbed out.
vi.mock("../KitVoicePanels", () => ({ default: () => null }));
vi.mock("../KitStepSequencer", () => ({ default: () => null }));
vi.mock("../KitForm", () => ({ default: () => null }));
vi.mock("../hooks/kit-management/useKitPlayback", () => ({
  useKitPlayback: vi.fn(() => ({
    handlePlay: vi.fn(),
    handleStop: vi.fn(),
    handleWaveformPlayingChange: vi.fn(),
    playbackError: null,
    playTriggers: {},
    samplePlaying: null,
    stopTriggers: {},
  })),
}));

type ToggleFavorite = (
  kitName: string,
) => Promise<DbResult<{ isFavorite: boolean }>>;

const favoriteButton = (title: string) => screen.getByTitle(title);

// Holds the kit the way KitsView does: a successful toggle flips the star
function EditorWithKit({
  initialFavorite,
  onMessage,
  toggle,
}: {
  initialFavorite: boolean;
  onMessage: (text: string, type?: string) => void;
  toggle: ToggleFavorite;
}) {
  const [kit, setKit] = React.useState<KitWithRelations>(() =>
    createMockKitWithRelations({ is_favorite: initialFavorite, name: "A0" }),
  );
  const onToggleFavorite = async (kitName: string) => {
    const result = await toggle(kitName);
    if (result.success && result.data) {
      const isFavorite = result.data.isFavorite;
      setKit((k) => ({ ...k, is_favorite: isFavorite }));
    }
    return result;
  };
  return (
    <KitEditor
      kit={kit}
      kitName="A0"
      onMessage={onMessage}
      onToggleFavorite={onToggleFavorite}
    />
  );
}

const pressFavoriteKey = async () => {
  await act(async () => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: ";" }));
  });
};

const clickFavoriteButton = async (title: string) => {
  await act(async () => {
    fireEvent.click(favoriteButton(title));
  });
};

describe("[UC-10] KitEditor favorite (#554)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
  });

  afterEach(() => {
    cleanup();
  });

  describe.each([
    {
      initialFavorite: false,
      message: "Couldn't add kit A0 to favorites. Try again.",
      title: "Add to favorites",
    },
    {
      initialFavorite: true,
      message: "Couldn't remove kit A0 from favorites. Try again.",
      title: "Remove from favorites",
    },
  ])("when $title fails", ({ initialFavorite, message, title }) => {
    const failing = () =>
      vi
        .fn<ToggleFavorite>()
        .mockResolvedValue({ error: "db locked", success: false });

    it("the star button says so", async () => {
      const onMessage = vi.fn();
      const toggle = failing();
      render(
        <EditorWithKit
          initialFavorite={initialFavorite}
          onMessage={onMessage}
          toggle={toggle}
        />,
      );

      await clickFavoriteButton(title);

      expect(toggle).toHaveBeenCalledWith("A0");
      expect(onMessage).toHaveBeenCalledWith(message, "error");
      // The star stays as it was
      expect(favoriteButton(title)).toBeInTheDocument();
    });

    it("the ; key says so", async () => {
      const onMessage = vi.fn();
      const toggle = failing();
      render(
        <EditorWithKit
          initialFavorite={initialFavorite}
          onMessage={onMessage}
          toggle={toggle}
        />,
      );

      await pressFavoriteKey();

      expect(toggle).toHaveBeenCalledWith("A0");
      expect(onMessage).toHaveBeenCalledWith(message, "error");
    });

    it("the star button says so when the call throws", async () => {
      const onMessage = vi.fn();
      const toggle = vi
        .fn<ToggleFavorite>()
        .mockRejectedValue(new Error("IPC gone"));
      render(
        <EditorWithKit
          initialFavorite={initialFavorite}
          onMessage={onMessage}
          toggle={toggle}
        />,
      );

      await clickFavoriteButton(title);

      expect(onMessage).toHaveBeenCalledWith(message, "error");
    });
  });

  it("a successful toggle from the button updates the star", async () => {
    const onMessage = vi.fn();
    let saved = false;
    const toggle = vi.fn<ToggleFavorite>(async () => {
      saved = !saved;
      return { data: { isFavorite: saved }, success: true };
    });
    render(
      <EditorWithKit
        initialFavorite={false}
        onMessage={onMessage}
        toggle={toggle}
      />,
    );

    await clickFavoriteButton("Add to favorites");
    expect(favoriteButton("Remove from favorites")).toBeInTheDocument();

    await clickFavoriteButton("Remove from favorites");
    expect(favoriteButton("Add to favorites")).toBeInTheDocument();

    expect(toggle).toHaveBeenCalledTimes(2);
    expect(onMessage).not.toHaveBeenCalledWith(expect.anything(), "error");
  });

  it("a successful toggle from ; updates the star", async () => {
    const onMessage = vi.fn();
    const toggle = vi
      .fn<ToggleFavorite>()
      .mockResolvedValue({ data: { isFavorite: true }, success: true });
    render(
      <EditorWithKit
        initialFavorite={false}
        onMessage={onMessage}
        toggle={toggle}
      />,
    );

    await pressFavoriteKey();

    expect(favoriteButton("Remove from favorites")).toBeInTheDocument();
    expect(onMessage).not.toHaveBeenCalledWith(expect.anything(), "error");
  });
});
