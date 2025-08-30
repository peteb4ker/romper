import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchActions, SearchState } from "../SearchInput";

import SearchInput from "../SearchInput";

describe("SearchInput", () => {
  const mockActions: SearchActions = {
    onChange: vi.fn(),
    onClear: vi.fn(),
  };

  const mockState: SearchState = {
    isSearching: false,
    resultCount: 0,
    value: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("should render with default props", () => {
      render(<SearchInput actions={mockActions} state={mockState} />);

      const input = screen.getByRole("textbox", { name: /search kits/i });
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute(
        "placeholder",
        "Search kits, samples, artists...",
      );
    });

    it("should render with custom placeholder", () => {
      render(
        <SearchInput
          actions={mockActions}
          placeholder="Custom placeholder"
          state={mockState}
        />,
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("placeholder", "Custom placeholder");
    });

    it("should apply custom className", () => {
      render(
        <SearchInput
          actions={mockActions}
          className="custom-class"
          state={mockState}
        />,
      );

      const container = screen
        .getByRole("textbox")
        .closest("div")?.parentElement;
      expect(container).toHaveClass("custom-class");
    });

    it("should auto-focus when autoFocus is true", () => {
      render(
        <SearchInput
          actions={mockActions}
          autoFocus={true}
          state={mockState}
        />,
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveFocus();
    });
  });

  describe("search icon", () => {
    it("should display search icon", () => {
      render(<SearchInput actions={mockActions} state={mockState} />);

      // Check for search icon (FiSearch)
      const searchIcon = document.querySelector("svg");
      expect(searchIcon).toBeInTheDocument();
    });
  });

  describe("input interactions", () => {
    it("should call onChange when user types", async () => {
      const user = userEvent.setup();

      render(<SearchInput actions={mockActions} state={mockState} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "test query");

      expect(mockActions.onChange).toHaveBeenCalledTimes(10); // Each character
      // userEvent.type() calls onChange for each character
      expect(mockActions.onChange).toHaveBeenCalledWith("t");
      expect(mockActions.onChange).toHaveBeenCalledWith("y");
    });

    it("should display current value", () => {
      const stateWithValue = { ...mockState, value: "current value" };

      render(<SearchInput actions={mockActions} state={stateWithValue} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("current value");
    });

    it("should handle keyboard shortcuts", async () => {
      const user = userEvent.setup();
      const stateWithValue = { ...mockState, value: "test" };

      render(<SearchInput actions={mockActions} state={stateWithValue} />);

      const input = screen.getByRole("textbox");
      input.focus();

      await user.keyboard("{Escape}");

      expect(mockActions.onClear).toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("should show loading spinner when searching", () => {
      const searchingState = { ...mockState, isSearching: true, value: "test" };

      render(<SearchInput actions={mockActions} state={searchingState} />);

      expect(screen.getByLabelText("Searching...")).toBeInTheDocument();
      expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
    });

    it("should not show loading spinner when not searching", () => {
      const stateWithValue = { ...mockState, value: "test" };

      render(<SearchInput actions={mockActions} state={stateWithValue} />);

      expect(screen.queryByLabelText("Searching...")).not.toBeInTheDocument();
    });
  });

  describe("clear button", () => {
    it("should show clear button when there is a value and not searching", () => {
      const stateWithValue = { ...mockState, value: "test" };

      render(<SearchInput actions={mockActions} state={stateWithValue} />);

      expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
    });

    it("should not show clear button when value is empty", () => {
      render(<SearchInput actions={mockActions} state={mockState} />);

      expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
    });

    it("should not show clear button when searching", () => {
      const searchingState = { ...mockState, isSearching: true, value: "test" };

      render(<SearchInput actions={mockActions} state={searchingState} />);

      expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
    });

    it("should call onClear when clear button is clicked", async () => {
      const user = userEvent.setup();
      const stateWithValue = { ...mockState, value: "test" };

      render(<SearchInput actions={mockActions} state={stateWithValue} />);

      const clearButton = screen.getByLabelText("Clear search");
      await user.click(clearButton);

      expect(mockActions.onClear).toHaveBeenCalled();
    });
  });

  describe("result counter", () => {
    it("should show result count when query is long enough and not searching", () => {
      const stateWithResults = {
        isSearching: false,
        resultCount: 5,
        value: "test query",
      };

      render(<SearchInput actions={mockActions} state={stateWithResults} />);

      expect(screen.getByText("5 kits found")).toBeInTheDocument();
    });

    it("should show singular form for single result", () => {
      const stateWithOneResult = {
        isSearching: false,
        resultCount: 1,
        value: "test query",
      };

      render(<SearchInput actions={mockActions} state={stateWithOneResult} />);

      expect(screen.getByText("1 kit found")).toBeInTheDocument();
    });

    it('should show "No kits found" for zero results', () => {
      const stateWithNoResults = {
        isSearching: false,
        resultCount: 0,
        value: "test query",
      };

      render(<SearchInput actions={mockActions} state={stateWithNoResults} />);

      expect(screen.getByText("No kits found")).toBeInTheDocument();
    });

    it("should not show result count for short queries", () => {
      const stateWithShortQuery = {
        isSearching: false,
        resultCount: 5,
        value: "a",
      };

      render(<SearchInput actions={mockActions} state={stateWithShortQuery} />);

      expect(screen.queryByText("5 kits found")).not.toBeInTheDocument();
    });

    it("should not show result count while searching", () => {
      const searchingState = {
        isSearching: true,
        resultCount: 5,
        value: "test query",
      };

      render(<SearchInput actions={mockActions} state={searchingState} />);

      expect(screen.queryByText("5 kits found")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper ARIA attributes", () => {
      const stateWithResults = {
        isSearching: false,
        resultCount: 5,
        value: "test query",
      };

      render(<SearchInput actions={mockActions} state={stateWithResults} />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-label", "Search kits");
      expect(input).toHaveAttribute("aria-describedby", "search-results-count");

      const resultsCount = screen.getByRole("status");
      expect(resultsCount).toHaveAttribute("aria-live", "polite");
      expect(resultsCount).toHaveAttribute("id", "search-results-count");
    });

    it("should not have aria-describedby for short queries", () => {
      const stateWithShortQuery = { ...mockState, value: "a" };

      render(<SearchInput actions={mockActions} state={stateWithShortQuery} />);

      const input = screen.getByRole("textbox");
      expect(input).not.toHaveAttribute("aria-describedby");
    });
  });

  describe("input width behavior", () => {
    it("should have different widths based on whether there is a value", () => {
      const { rerender } = render(
        <SearchInput actions={mockActions} state={mockState} />,
      );

      const input = screen.getByRole("textbox", {
        name: /search kits/i,
      });
      expect(input).toHaveClass("w-56", "focus:w-80");

      const stateWithValue = { ...mockState, value: "test" };
      rerender(<SearchInput actions={mockActions} state={stateWithValue} />);

      const updatedInput = screen.getByRole("textbox", {
        name: /search kits/i,
      });
      expect(updatedInput).toHaveClass("w-80");
      expect(updatedInput).not.toHaveClass("focus:w-80");
    });
  });
});
