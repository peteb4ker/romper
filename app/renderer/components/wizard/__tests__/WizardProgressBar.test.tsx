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
        progress={{ file: "foo.wav", percent: 42, phase: "Copying" }}
      />,
    );
    expect(screen.getByText(/copying/i)).toBeInTheDocument();
    expect(screen.getByText(/42%/i)).toBeInTheDocument();
    expect(screen.getByTestId("wizard-progress-file")).toHaveTextContent(
      "foo.wav",
    );
  });

  it("renders nothing when progress is null", () => {
    const { container } = render(<WizardProgressBar progress={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when percent is missing", () => {
    const { container } = render(
      <WizardProgressBar progress={{ phase: "Copying" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("falls back to a default label when phase is empty", () => {
    render(<WizardProgressBar progress={{ percent: 10, phase: "" }} />);
    expect(screen.getByText("Working...")).toBeInTheDocument();
  });

  it("marks the bar complete at 100 percent", () => {
    render(<WizardProgressBar progress={{ percent: 100, phase: "Done" }} />);
    expect(screen.getByTestId("wizard-progress-bar")).toHaveAttribute(
      "data-complete",
      "true",
    );
  });

  it("shows kit-by-kit progress using the kit name when available", () => {
    render(
      <WizardProgressBar
        progress={{
          currentKit: 2,
          kitName: "B1",
          percent: 50,
          phase: "Scanning",
          totalKits: 5,
        }}
      />,
    );
    expect(screen.getByTestId("wizard-progress-kit")).toHaveTextContent(
      "Kit B1 (2 of 5)",
    );
  });

  it("falls back to the kit index when no kit name is provided", () => {
    render(
      <WizardProgressBar
        progress={{
          currentKit: 3,
          percent: 60,
          phase: "Scanning",
          totalKits: 5,
        }}
      />,
    );
    expect(screen.getByTestId("wizard-progress-kit")).toHaveTextContent(
      "Kit 3 (3 of 5)",
    );
  });
});
