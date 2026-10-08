import type { DbResult, Sample } from "@romper/shared/db/schema";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import { createMockSample } from "../../../../tests/factories/sample.factory";
import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { createSlotPlaybackStore } from "../hooks/kit-management/slotPlaybackStore";
import KitVoicePanels from "../KitVoicePanels";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

type OnMessage = NonNullable<
  React.ComponentProps<typeof KitVoicePanels>["onMessage"]
>;

const failedA0 = "Couldn't load the samples for kit A0. Try reopening it.";
const failedA1 = "Couldn't load the samples for kit A1. Try reopening it.";

// Each kit has kick.wav in voice 1 slot 1, with its own gain
const kickIn = (kitName: string, gainDb: number): DbResult<Sample[]> => ({
  data: [
    createMockSample({
      filename: "kick.wav",
      gain_db: gainDb,
      kit_name: kitName,
      source_path: `/store/${kitName}/kick.wav`,
    }),
  ],
  success: true,
});

function Panels({
  kitName,
  onMessage,
}: {
  kitName: string;
  onMessage: OnMessage;
}) {
  // A new kit object, as a reload of the kit gives
  const kit = React.useMemo(
    () => createMockKitWithRelations({ editable: true, name: kitName }),
    [kitName],
  );
  return (
    <MockSettingsProvider>
      <MockMessageDisplayProvider>
        <KitVoicePanels
          isEditable
          kit={kit}
          kitName={kitName}
          onMessage={onMessage}
          onPlay={vi.fn()}
          onSampleKeyNav={vi.fn()}
          onSampleSelect={vi.fn()}
          onSaveVoiceName={vi.fn()}
          onStop={vi.fn()}
          onWaveformPlayingChange={vi.fn()}
          samples={{ 1: ["kick.wav"], 2: [], 3: [], 4: [] }}
          selectedSampleIdx={0}
          selectedVoice={1}
          sequencerOpen={false}
          setSelectedSampleIdx={vi.fn()}
          setSelectedVoice={vi.fn()}
          slotPlayback={createSlotPlaybackStore()}
        />
      </MockMessageDisplayProvider>
    </MockSettingsProvider>
  );
}

const knob = () => screen.getByRole("slider");

/** The knob shows "–" and can't be turned */
const expectUnknownGain = () => {
  expect(knob()).toHaveAttribute("aria-label", "Gain: –");
  expect(knob()).toHaveAttribute("aria-disabled", "true");
  expect(knob()).not.toHaveAttribute("aria-valuenow");
};

describe("[UC-07] [UC-24] a kit whose sample details can't be read (#628)", () => {
  const onMessage = vi.fn<OnMessage>();
  const getAllSamplesForKit = () =>
    vi.mocked(globalThis.electronAPI.getAllSamplesForKit);

  beforeEach(() => {
    setupElectronAPIMock();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    onMessage.mockReset();
  });

  describe.each([
    [
      "a thrown read",
      () => getAllSamplesForKit().mockRejectedValue(new Error("IPC closed")),
    ],
    [
      "a failure result",
      () =>
        getAllSamplesForKit().mockResolvedValue({
          error: "database is locked",
          success: false,
        }),
    ],
  ])("after %s", (_, failRead) => {
    it("says so, disables the gain knobs and shows – for the gain", async () => {
      failRead();

      render(<Panels kitName="A0" onMessage={onMessage} />);

      await waitFor(() =>
        expect(onMessage).toHaveBeenCalledWith(failedA0, "error"),
      );
      expect(onMessage).toHaveBeenCalledTimes(1);
      expectUnknownGain();

      fireEvent.wheel(knob(), { deltaY: -100 });
      fireEvent.keyDown(knob(), { key: "ArrowUp" });
      fireEvent.click(knob());
      expect(globalThis.electronAPI.updateSampleGain).not.toHaveBeenCalled();
      expectUnknownGain();
    });

    it("restores the knobs when reopening the kit reads them", async () => {
      failRead();
      const { unmount } = render(<Panels kitName="A0" onMessage={onMessage} />);
      await waitFor(() =>
        expect(onMessage).toHaveBeenCalledWith(failedA0, "error"),
      );
      unmount();
      getAllSamplesForKit().mockResolvedValue(kickIn("A0", -3));

      render(<Panels kitName="A0" onMessage={onMessage} />);

      await waitFor(() =>
        expect(knob()).toHaveAttribute("aria-valuenow", "-3"),
      );
      expect(knob()).toHaveAttribute("aria-label", "Gain: -3 dB");
      expect(knob()).not.toHaveAttribute("aria-disabled");
      fireEvent.wheel(knob(), { deltaY: -100 });
      // Saved once the wheel stops (RE-88)
      await waitFor(() =>
        expect(globalThis.electronAPI.updateSampleGain).toHaveBeenCalledWith(
          "A0",
          1,
          0,
          -2,
        ),
      );
      expect(onMessage).toHaveBeenCalledTimes(1);
    });

    it("never shows the previous kit's gains on the next kit", async () => {
      getAllSamplesForKit().mockResolvedValue(kickIn("A0", -3));
      const { rerender } = render(
        <Panels kitName="A0" onMessage={onMessage} />,
      );
      await waitFor(() =>
        expect(knob()).toHaveAttribute("aria-valuenow", "-3"),
      );
      failRead();

      rerender(<Panels kitName="A1" onMessage={onMessage} />);

      // Not A0's gain while A1's details are read, nor once they fail
      expectUnknownGain();
      await waitFor(() =>
        expect(onMessage).toHaveBeenCalledWith(failedA1, "error"),
      );
      expectUnknownGain();
    });
  });

  it("shows – while a kit's details are being read", async () => {
    let answer: (result: DbResult<Sample[]>) => void = () => {};
    getAllSamplesForKit().mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    render(<Panels kitName="A0" onMessage={onMessage} />);

    expectUnknownGain();
    await act(async () => {
      answer(kickIn("A0", 4));
    });
    expect(knob()).toHaveAttribute("aria-label", "Gain: +4 dB");
  });

  it("drops a read for a kit that's no longer on screen", async () => {
    const answers: Record<string, (result: DbResult<Sample[]>) => void> = {};
    getAllSamplesForKit().mockImplementation(
      (kitName: string) =>
        new Promise((resolve) => {
          answers[kitName] = resolve;
        }),
    );
    const { rerender } = render(<Panels kitName="A0" onMessage={onMessage} />);
    rerender(<Panels kitName="A1" onMessage={onMessage} />);

    await act(async () => {
      answers.A1(kickIn("A1", 2));
    });
    await act(async () => {
      answers.A0({ error: "database is locked", success: false });
    });

    expect(knob()).toHaveAttribute("aria-valuenow", "2");
    expect(onMessage).not.toHaveBeenCalled();
  });
});
