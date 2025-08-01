import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import WizardStepNav from "../WizardStepNav";

afterEach(() => {
  cleanup();
});

describe("WizardStepNav", () => {
  it("renders all step labels and highlights current step", () => {
    const stepLabels = ["Source", "Target", "Initialize"];
    render(<WizardStepNav stepLabels={stepLabels} currentStep={1} />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    expect(screen.getByText("Initialize")).toBeInTheDocument();
    // Current step should be highlighted
    expect(screen.getByText("Target").className).toMatch(/blue/);
  });
});
