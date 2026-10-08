import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WizardErrorMessage from "../WizardErrorMessage";

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
