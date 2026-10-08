import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import ModalDialog from "../ModalDialog";

function Dialog(props: Partial<React.ComponentProps<typeof ModalDialog>>) {
  return (
    <ModalDialog aria-labelledby="t" data-testid="dlg" {...props}>
      <h2 id="t">Title</h2>
      <button type="button">First</button>
      <input aria-label="Middle" />
      <button type="button">Last</button>
    </ModalDialog>
  );
}

// RE-48: modals had no dialog role, focus trap or Escape
describe("[Q-06] ModalDialog", () => {
  it("is a labelled modal dialog", () => {
    render(<Dialog />);
    const dialog = screen.getByRole("dialog", { name: "Title" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("takes focus when it opens and gives it back when it closes", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<Dialog />);
    expect(screen.getByRole("dialog")).toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("keeps a control that took focus with autoFocus", () => {
    render(
      <ModalDialog aria-label="Auto">
        <button type="button">One</button>
        <button autoFocus type="button">
          Two
        </button>
      </ModalDialog>,
    );
    expect(screen.getByRole("button", { name: "Two" })).toHaveFocus();
  });

  it("keeps Tab and Shift+Tab inside", async () => {
    const user = userEvent.setup();
    render(<Dialog />);

    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("leaves Escape alone in a dialog that must be answered", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    document.addEventListener("keydown", onEscape);
    render(<Dialog />);

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onEscape.mock.calls[0][0].defaultPrevented).toBe(false);
    document.removeEventListener("keydown", onEscape);
  });

  it("closes only the innermost of two dialogs on Escape", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <ModalDialog aria-label="Outer" onClose={outer}>
          <button type="button">Outer button</button>
        </ModalDialog>
        <ModalDialog aria-label="Inner" onClose={inner}>
          <button type="button">Inner button</button>
        </ModalDialog>
      </>,
    );

    await user.keyboard("{Escape}");
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it("closes on a backdrop click only when asked to", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<Dialog onClose={onClose} />);

    await user.click(screen.getByTestId("dlg-backdrop"));
    expect(onClose).not.toHaveBeenCalled();

    rerender(<Dialog closeOnBackdropClick onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "First" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("dlg-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("can render without a backdrop", () => {
    render(<Dialog overlayClassName={null} />);
    expect(screen.queryByTestId("dlg-backdrop")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
