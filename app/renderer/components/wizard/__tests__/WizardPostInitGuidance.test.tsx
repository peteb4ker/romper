import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import WizardPostInitGuidance from "../WizardPostInitGuidance";

describe("WizardPostInitGuidance", () => {
  it("[UC-03] renders blank folder guidance when isBlankFolder is true", () => {
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

  it("[UC-01] lists each voice over 12 with the files it left out (#518)", () => {
    const warnings = [
      {
        kept: 12,
        kitName: "A0",
        skipped: 1,
        skippedFiles: ["1 Kick 13.wav"],
        total: 13,
        voiceNumber: 1,
      },
      {
        kept: 12,
        kitName: "B1",
        skipped: 2,
        skippedFiles: ["2 Snare 13.wav", "2 Snare 14.wav"],
        total: 14,
        voiceNumber: 2,
      },
    ];
    render(
      <WizardPostInitGuidance
        isBlankFolder={false}
        onDismiss={vi.fn()}
        truncationWarnings={warnings}
      />,
    );
    expect(screen.getByTestId("truncation-warnings")).toBeInTheDocument();
    const voices = screen.getAllByTestId("truncation-warning");
    expect(voices).toHaveLength(2);
    expect(
      voices.map(
        (v) => within(v).getByTestId("truncation-warning-summary").textContent,
      ),
    ).toEqual([
      "Kit A0, Voice 1: 1 of 13 samples skipped (kept first 12):",
      "Kit B1, Voice 2: 2 of 14 samples skipped (kept first 12):",
    ]);
    expect(
      voices.map((v) =>
        within(within(v).getByTestId("truncation-warning-files"))
          .getAllByRole("listitem")
          .map((li) => li.textContent),
      ),
    ).toEqual([["1 Kick 13.wav"], ["2 Snare 13.wav", "2 Snare 14.wav"]]);
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

  it("[UC-01] lists the setup summary's stereo lines (#537)", () => {
    const lines = [
      "Kit A0: voices 1 and 2 linked automatically as a stereo pair.",
      "Kit B1: voices 3 and 4 linked automatically as a stereo pair.",
    ];
    render(
      <WizardPostInitGuidance
        isBlankFolder={false}
        onDismiss={vi.fn()}
        stereoNotices={lines.map((message, i) => ({
          kitName: "A0",
          message,
          voiceNumber: i + 1,
        }))}
      />,
    );
    const items = within(screen.getByTestId("stereo-summary")).getAllByRole(
      "listitem",
    );
    expect(items.map((li) => li.textContent)).toEqual(lines);
    expect(screen.queryByTestId("truncation-warnings")).toBeNull();
  });

  it("[UC-01] [Q-04] shows the notice when the copy of _save failed (#802)", () => {
    const notice = "Romper couldn't keep a copy";
    const { rerender } = render(
      <WizardPostInitGuidance
        isBlankFolder={false}
        onDismiss={vi.fn()}
        rampleSaveNotice={notice}
      />,
    );
    expect(screen.getByTestId("rample-save-notice")).toHaveTextContent(notice);

    rerender(
      <WizardPostInitGuidance isBlankFolder={false} onDismiss={vi.fn()} />,
    );
    expect(screen.queryByTestId("rample-save-notice")).toBeNull();
  });

  it("does not list stereo lines when there are none", () => {
    render(
      <WizardPostInitGuidance
        isBlankFolder={false}
        onDismiss={vi.fn()}
        stereoNotices={[]}
      />,
    );
    expect(screen.queryByTestId("stereo-summary")).toBeNull();
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
      {
        kept: 12,
        kitName: "C2",
        skipped: 1,
        skippedFiles: ["3 Hat 13.wav"],
        total: 13,
        voiceNumber: 3,
      },
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
