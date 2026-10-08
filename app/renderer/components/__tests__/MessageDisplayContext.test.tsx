import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { useMessageDisplay } from "../hooks/shared/useMessageDisplay";

import { MessageDisplayContext } from "../MessageDisplayContext";

describe("MessageDisplayContext", () => {
  describe("Context creation", () => {
    it("should handle null value as default", () => {
      const TestConsumer: React.FC = () => {
        const context = React.useContext(MessageDisplayContext);
        return (
          <div data-testid="context-value">
            {context ? "has-value" : "null"}
          </div>
        );
      };

      const { getByTestId } = render(<TestConsumer />);
      expect(getByTestId("context-value")).toHaveTextContent("null");
    });
  });

  describe("React Context behavior", () => {
    it("should properly provide and consume context values", () => {
      const mockMessageDisplay: ReturnType<typeof useMessageDisplay> = {
        clearMessages: vi.fn(),
        dismissMessage: vi.fn(),
        messages: [
          { duration: 4000, id: 1, text: "test message", type: "info" },
        ],
        showMessage: vi.fn(() => 1),
      };

      const TestConsumer: React.FC = () => {
        const context = React.useContext(MessageDisplayContext);
        return (
          <div data-testid="test-message">
            {context?.messages[0]?.text || "no-message"}
          </div>
        );
      };

      const { getByTestId } = render(
        <MessageDisplayContext.Provider value={mockMessageDisplay}>
          <TestConsumer />
        </MessageDisplayContext.Provider>,
      );

      expect(getByTestId("test-message")).toHaveTextContent("test message");
    });
  });
});
