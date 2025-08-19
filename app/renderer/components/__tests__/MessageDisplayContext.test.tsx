import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { MessageDisplayContext } from "../MessageDisplayContext";

describe("MessageDisplayContext", () => {
  describe("Context creation", () => {
    it("should create context with correct default value", () => {
      expect(MessageDisplayContext).toBeDefined();
      expect(MessageDisplayContext._currentValue).toBeNull();
    });

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

  describe("TypeScript interface validation", () => {
    it("should accept proper useMessageDisplay return type", () => {
      // Mock the useMessageDisplay return type
      const mockUseMessageDisplayReturn = {
        clearMessage: () => {},
        currentMessage: null,
        showMessage: () => {},
      };

      // This tests that the context can accept the proper type
      const TestProvider: React.FC<{ children: React.ReactNode }> = ({
        children,
      }) => (
        <MessageDisplayContext.Provider value={mockUseMessageDisplayReturn}>
          {children}
        </MessageDisplayContext.Provider>
      );

      expect(TestProvider).toBeDefined();
    });
  });

  describe("React Context behavior", () => {
    it("should properly provide and consume context values", () => {
      const mockMessageDisplay = {
        clearMessage: () => {},
        currentMessage: "test message",
        showMessage: () => {},
      };

      const TestConsumer: React.FC = () => {
        const context = React.useContext(MessageDisplayContext);
        return (
          <div data-testid="test-message">
            {context?.currentMessage || "no-message"}
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
