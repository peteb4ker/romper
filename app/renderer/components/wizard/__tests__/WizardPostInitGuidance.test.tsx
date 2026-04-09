import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import WizardPostInitGuidance from "../WizardPostInitGuidance";

afterEach(() => {
  cleanup();
});

describe("WizardPostInitGuidance", () => {
  it("renders blank folder guidance when isBlankFolder is true", () => {
    render(<WizardPostInitGuidance isBlankFolder={true} onDismiss={vi.fn()} />);
    expect(screen.getByTestId("blank-folder-guidance")).toBeInTheDocument();
    expect(screen.getByTestId("post-init-continue-btn")).toHaveTextContent(
      "Open Kit Browser",
    );
  });

  it("does not render blank folder guidance when isBlankFolder is false", () => {
    render(
      <WizardPostInitGuidance isBlankFolder={false} onDismiss={vi.fn()} />,
    );
    expect(screen.queryByTestId("blank-folder-guidance")).toBeNull();
    expect(screen.getByTestId("post-init-continue-btn")).toHaveTextContent(
      "Continue",
    );
  });

  it("renders truncation warnings when provided", () => {
    const warnings = [
      { kept: 12, kitName: "A0", skipped: 3, total: 15, voiceNumber: 1 },
      { kept: 12, kitName: "B1", skipped: 5, total: 17, voiceNumber: 2 },
    ];
    render(
      <WizardPostInitGuidance
        isBlankFolder={false}
        onDismiss={vi.fn()}
        truncationWarnings={warnings}
      />,
    );
    expect(screen.getByTestId("truncation-warnings")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("A0");
    expect(items[1].textContent).toContain("B1");
  });

  it("does not render truncation warnings when empty", () => {
    render(
      <WizardPostInitGuidance
        isBlankFolder={true}
        onDismiss={vi.fn()}
        truncationWarnings={[]}
      />,
    );
    expect(screen.queryByTestId("truncation-warnings")).toBeNull();
  });

  it("calls onDismiss when continue button clicked", async () => {
    const onDismiss = vi.fn();
    render(
      <WizardPostInitGuidance isBlankFolder={false} onDismiss={onDismiss} />,
    );
    await userEvent.click(screen.getByTestId("post-init-continue-btn"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders both blank folder guidance and warnings together", () => {
    const warnings = [
      { kept: 12, kitName: "C2", skipped: 1, total: 13, voiceNumber: 3 },
    ];
    render(
      <WizardPostInitGuidance
        isBlankFolder={true}
        onDismiss={vi.fn()}
        truncationWarnings={warnings}
      />,
    );
    expect(screen.getByTestId("blank-folder-guidance")).toBeInTheDocument();
    expect(screen.getByTestId("truncation-warnings")).toBeInTheDocument();
  });
});
