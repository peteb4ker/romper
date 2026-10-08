import type { Sample } from "@romper/shared/db/schema";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Each kit has kick.wav in voice 1 slot 1, with its own gain
const kickIn = (kitName: string, gainDb: number): Sample[] => [
  createMockSample({
    filename: "kick.wav",
    gain_db: gainDb,
    kit_name: kitName,
    source_path: `/store/${kitName}/kick.wav`,
  }),
];

function Panels({
  kitFor = undefined,
  kitName,
  onMessage,
  rows,
}: {
  /** The kit the panels are given, when it isn't the one named */
  kitFor?: string;
  kitName: string;
  onMessage: OnMessage;
  /** The kit's rows; a kit listed without them has none (#605) */
  rows?: Sample[];
}) {
  // A new kit object, as a reload of the kit gives
  const kit = React.useMemo(
    () =>
      createMockKitWithRelations({
        editable: true,
        name: kitFor ?? kitName,
        samples: rows,
      }),
    [kitFor, kitName, rows],
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

// The details come from the kit's rows (#452), so the panels never ask
// main for them. A kit listed without its rows has no gains to show until
// reopening it loads them; the kit data manager says so (#605, #628).
describe("[UC-07] [UC-24] a kit's sample details (#628, #452)", () => {
  const onMessage = vi.fn<OnMessage>();

  beforeEach(() => {
    setupElectronAPIMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    onMessage.mockReset();
  });

  it("[Q-01] shows each slot's gain as the kit opens, without asking main", () => {
    render(
      <Panels kitName="A0" onMessage={onMessage} rows={kickIn("A0", 4)} />,
    );

    expect(knob()).toHaveAttribute("aria-label", "Gain: +4 dB");
    expect(globalThis.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
  });

  describe("a kit listed without its rows", () => {
    it("disables the gain knobs and shows – for the gain, without a message of its own", () => {
      render(<Panels kitName="A0" onMessage={onMessage} />);

      expectUnknownGain();
      fireEvent.wheel(knob(), { deltaY: -100 });
      fireEvent.keyDown(knob(), { key: "ArrowUp" });
      fireEvent.click(knob());
      expect(globalThis.electronAPI.updateSampleGain).not.toHaveBeenCalled();
      expectUnknownGain();
      expect(onMessage).not.toHaveBeenCalled();
      expect(globalThis.electronAPI.getAllSamplesForKit).not.toHaveBeenCalled();
    });

    it("restores the knobs once the kit's rows load", async () => {
      const { rerender } = render(
        <Panels kitName="A0" onMessage={onMessage} />,
      );
      expectUnknownGain();

      rerender(
        <Panels kitName="A0" onMessage={onMessage} rows={kickIn("A0", -3)} />,
      );

      expect(knob()).toHaveAttribute("aria-valuenow", "-3");
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
    });
  });

  it("never shows the previous kit's gains on the next kit", () => {
    const { rerender } = render(
      <Panels kitName="A0" onMessage={onMessage} rows={kickIn("A0", -3)} />,
    );
    expect(knob()).toHaveAttribute("aria-valuenow", "-3");

    // A1 listed without its rows, and A0's kit object still given while
    // the editor catches up
    rerender(<Panels kitName="A1" onMessage={onMessage} />);
    expectUnknownGain();
    rerender(
      <Panels
        kitFor="A0"
        kitName="A1"
        onMessage={onMessage}
        rows={kickIn("A0", -3)}
      />,
    );
    expectUnknownGain();

    rerender(
      <Panels kitName="A1" onMessage={onMessage} rows={kickIn("A1", 2)} />,
    );
    expect(knob()).toHaveAttribute("aria-valuenow", "2");
  });
});
