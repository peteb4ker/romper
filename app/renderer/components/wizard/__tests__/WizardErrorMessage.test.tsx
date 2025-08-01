import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import WizardErrorMessage from "../WizardErrorMessage";

afterEach(() => {
  cleanup();
});

describe("WizardErrorMessage", () => {
  it("renders error message when errorMessage is present", () => {
    render(<WizardErrorMessage errorMessage="fail!" />);
    expect(screen.getByTestId("wizard-error")).toHaveTextContent("fail!");
  });
  it("renders nothing when errorMessage is null", () => {
    render(<WizardErrorMessage errorMessage={null} />);
    expect(screen.queryByTestId("wizard-error")).toBeNull();
  });
});
