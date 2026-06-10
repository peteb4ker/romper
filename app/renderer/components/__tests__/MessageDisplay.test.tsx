import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DisplayMessage } from "../hooks/shared/useMessageDisplay";

import MessageDisplay from "../MessageDisplay";
import { MessageDisplayContext } from "../MessageDisplayContext";

function renderWith(messages: DisplayMessage[], dismissMessage = vi.fn()) {
  const { container, unmount } = render(
    <MessageDisplayContext.Provider
      value={{
        clearMessages: vi.fn(),
        dismissMessage,
        messages,
        showMessage: vi.fn(),
      }}
    >
      <MessageDisplay />
    </MessageDisplayContext.Provider>,
  );
  cleanups.push(unmount);
  return within(container);
}

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
});

const msg = (over: Partial<DisplayMessage>): DisplayMessage => ({
  duration: 5000,
  id: 1,
  text: "Something happened",
  type: "info",
  ...over,
});

describe("MessageDisplay", () => {
  it("renders nothing when there are no messages", () => {
    const { container } = render(
      <MessageDisplayContext.Provider
        value={{
          clearMessages: vi.fn(),
          dismissMessage: vi.fn(),
          messages: [],
          showMessage: vi.fn(),
        }}
      >
        <MessageDisplay />
      </MessageDisplayContext.Provider>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders a message with its text", () => {
    const view = renderWith([msg({ text: "Kit deleted", type: "success" })]);
    expect(view.getByText("Kit deleted")).toBeInTheDocument();
    expect(view.getByTestId("message-success")).toBeInTheDocument();
  });

  it("uses role=alert for errors and role=status otherwise", () => {
    const view = renderWith([
      msg({ id: 1, text: "Boom", type: "error" }),
      msg({ id: 2, text: "FYI", type: "info" }),
    ]);
    expect(view.getByText("Boom").closest("[role]")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(view.getByText("FYI").closest("[role]")).toHaveAttribute(
      "role",
      "status",
    );
  });

  it("dismisses a message when the close button is clicked", () => {
    const dismissMessage = vi.fn();
    const view = renderWith(
      [msg({ id: 42, text: "Only one" })],
      dismissMessage,
    );

    fireEvent.click(view.getByLabelText("Dismiss message"));
    expect(dismissMessage).toHaveBeenCalledWith(42);
  });

  it("renders multiple stacked messages", () => {
    const view = renderWith([
      msg({ id: 1, text: "One" }),
      msg({ id: 2, text: "Two", type: "warning" }),
    ]);
    expect(view.getByText("One")).toBeInTheDocument();
    expect(view.getByText("Two")).toBeInTheDocument();
  });
});
