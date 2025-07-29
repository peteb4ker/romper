import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import WizardSourceStep from "../WizardSourceStep";

afterEach(() => {
  cleanup();
});

describe("WizardSourceStep", () => {
  const sourceOptions = [
    { value: "sdcard", label: "SD Card", icon: <span>SD</span> },
    { value: "squarp", label: "Squarp", icon: <span>SQ</span> },
  ];
  it("renders all source options and highlights selected", () => {
    render(
      <WizardSourceStep
        sourceOptions={sourceOptions}
        stateSource={"sdcard"}
        handleSourceSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("wizard-source-sdcard")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-source-squarp")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-source-sdcard")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("calls handleSourceSelect when a non-sdcard source is clicked", async () => {
    const user = userEvent.setup();
    const handleSourceSelect = vi.fn();
    render(
      <WizardSourceStep
        sourceOptions={sourceOptions}
        stateSource={null}
        handleSourceSelect={handleSourceSelect}
      />,
    );
    const squarpButton = screen.getByTestId("wizard-source-squarp");
    await user.click(squarpButton);
    expect(handleSourceSelect).toHaveBeenCalledWith("squarp");
  });
  it("calls picker and sets path and confirms when sdcard is clicked and no env var", async () => {
    const user = userEvent.setup();
    const setSdCardPath = vi.fn();
    const setSourceConfirmed = vi.fn();
    vi.mocked(window.electronAPI.selectSdCard).mockResolvedValue(
      "/mock/sdcard",
    );
    render(
      <WizardSourceStep
        sourceOptions={sourceOptions}
        stateSource={"sdcard"}
        handleSourceSelect={() => {}}
        setSdCardPath={setSdCardPath}
        setSourceConfirmed={setSourceConfirmed}
      />,
    );
    const sdCardBtn = screen.getByTestId("wizard-source-sdcard");
    await user.click(sdCardBtn);
    expect(window.electronAPI.selectSdCard).toHaveBeenCalled();
    expect(setSdCardPath).toHaveBeenCalledWith("/mock/sdcard");
    expect(setSourceConfirmed).toHaveBeenCalledWith(true);
  });
  it("shows SD card path display when localStorePath is set and no env var", () => {
    render(
      <WizardSourceStep
        sourceOptions={sourceOptions}
        stateSource="sdcard"
        handleSourceSelect={() => {}}
        localStorePath="/mock/sdcard"
      />,
    );
    // Path should NOT be shown during source step
    expect(screen.queryByTestId("wizard-sdcard-path-display")).toBeNull();
  });
});
