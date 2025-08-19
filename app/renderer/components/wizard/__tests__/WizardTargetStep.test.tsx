import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import WizardTargetStep from "../WizardTargetStep";

afterEach(() => {
  cleanup();
});

describe("WizardTargetStep", () => {
  it("renders target path input and buttons", () => {
    render(
      <WizardTargetStep
        configSdCardPath={"/mock/sdcard"}
        defaultPath="/mock/default"
        safeSelectLocalStorePath={() => {}}
        setTargetPath={() => {}}
        stateTargetPath="/mock/target"
      />
    );
    expect(screen.getByLabelText(/local store path/i)).toBeInTheDocument();
    expect(screen.getAllByText(/choose/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/use default/i)).toBeInTheDocument();
  });
});
