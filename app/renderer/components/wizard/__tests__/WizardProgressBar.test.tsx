import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import WizardProgressBar from "../WizardProgressBar";

afterEach(() => {
  cleanup();
});

describe("WizardProgressBar", () => {
  it("renders progress bar with correct phase and percent", () => {
    render(
      <WizardProgressBar
        progress={{ phase: "Copying", percent: 42, file: "foo.wav" }}
      />,
    );
    expect(screen.getByText(/copying/i)).toBeInTheDocument();
    expect(screen.getByText(/42%/i)).toBeInTheDocument();
    expect(screen.getByTestId("wizard-progress-file")).toHaveTextContent(
      "foo.wav",
    );
  });
});
