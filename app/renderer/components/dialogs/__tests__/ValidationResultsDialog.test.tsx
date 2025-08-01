import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useValidationResults } from "../../hooks/useValidationResults";
import ValidationResultsDialog from "../ValidationResultsDialog";

// Mock the useValidationResults hook
vi.mock("../../hooks/useValidationResults");

describe("ValidationResultsDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnMessage = vi.fn();
  const mockLocalStorePath = "/mock/path";

  const mockValidResults = {
    isOpen: true,
    isLoading: false,
    isRescanning: false,
    validationResult: {
      isValid: true,
      errors: undefined,
      errorSummary: undefined,
    },
    groupedErrors: null,
    selectedKits: [],
    openValidationDialog: vi.fn(),
    closeValidationDialog: vi.fn(),
    toggleKitSelection: vi.fn(),
    selectAllKits: vi.fn(),
    rescanSelectedKits: vi.fn(),
    validateLocalStore: vi.fn(),
  };

  const mockInvalidResults = {
    isOpen: true,
    isLoading: false,
    isRescanning: false,
    validationResult: {
      isValid: false,
      errors: [
        {
          kitName: "A1",
          missingFiles: ["kick.wav"],
          extraFiles: [],
        },
        {
          kitName: "B2",
          missingFiles: [],
          extraFiles: ["snare.wav"],
        },
      ],
      errorSummary: "Found 2 kit(s) with validation errors",
    },
    groupedErrors: {
      missing: [{ kitName: "A1", missingFiles: ["kick.wav"], extraFiles: [] }],
      extra: [{ kitName: "B2", missingFiles: [], extraFiles: ["snare.wav"] }],
      both: [],
    },
    selectedKits: [],
    openValidationDialog: vi.fn(),
    closeValidationDialog: vi.fn(),
    toggleKitSelection: vi.fn(),
    selectAllKits: vi.fn(),
    rescanSelectedKits: vi.fn(),
    validateLocalStore: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Clear the DOM between tests
    document.body.innerHTML = "";
  });

  test("should not render when isOpen is false", () => {
    (useValidationResults as jest.Mock).mockReturnValue({
      ...mockValidResults,
      isOpen: false,
    });

    render(
      <ValidationResultsDialog
        isOpen={false}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    expect(
      screen.queryByText("Local Store Validation Results"),
    ).not.toBeInTheDocument();
  });

  test("should render loading state", () => {
    (useValidationResults as jest.Mock).mockReturnValue({
      ...mockValidResults,
      isLoading: true,
    });

    const { container } = render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    expect(
      screen.getAllByText("Local Store Validation Results")[0],
    ).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  test("should render valid results", () => {
    (useValidationResults as jest.Mock).mockReturnValue(mockValidResults);

    render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    expect(
      screen.getAllByText("Local Store Validation Results")[0],
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No validation errors found. The database matches the file system.",
      ),
    ).toBeInTheDocument();
  });

  test("should render invalid results with error groups", () => {
    (useValidationResults as jest.Mock).mockReturnValue(mockInvalidResults);

    render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    expect(
      screen.getAllByText("Local Store Validation Results")[0],
    ).toBeInTheDocument();
    expect(
      screen.getByText("Found 2 kit(s) with validation errors"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Kits with missing files (files in database but not in file system)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Kits with extra files (files in file system but not in database)",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText(/Missing files:/)).toBeInTheDocument();
    expect(screen.getByText("B2")).toBeInTheDocument();
    expect(screen.getByText(/Extra files:/)).toBeInTheDocument();
  });

  test("should handle kit selection", () => {
    const toggleKitSelectionMock = vi.fn();

    (useValidationResults as jest.Mock).mockReturnValue({
      ...mockInvalidResults,
      toggleKitSelection: toggleKitSelectionMock,
    });

    render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    // Find the list item that contains the kit name "A1"
    const kitA1ListItem = screen.getByText("A1").closest("li");
    expect(kitA1ListItem).not.toBeNull();

    // Get the checkbox within this list item
    const checkbox = within(kitA1ListItem!).getByRole("checkbox");

    fireEvent.click(checkbox);
    expect(toggleKitSelectionMock).toHaveBeenCalledWith("A1");
  });

  test("should handle select all", () => {
    const selectAllMock = vi.fn();

    (useValidationResults as jest.Mock).mockReturnValue({
      ...mockInvalidResults,
      selectAllKits: selectAllMock,
    });

    render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    const selectAllCheckbox = screen.getByLabelText("Select All");
    expect(selectAllCheckbox).toBeInTheDocument();

    fireEvent.click(selectAllCheckbox);
    expect(selectAllMock).toHaveBeenCalled();
  });

  test("should handle rescan button click", () => {
    const rescanSelectedKitsMock = vi.fn();

    (useValidationResults as jest.Mock).mockReturnValue({
      ...mockInvalidResults,
      selectedKits: ["A1", "B2"],
      rescanSelectedKits: rescanSelectedKitsMock,
    });

    render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    // Find the button by its role and text content together
    const buttons = screen.getAllByRole("button");
    const rescanButton = Array.from(buttons).find((button) =>
      button.textContent?.includes("Rescan Selected Kits"),
    );

    expect(rescanButton).toBeInTheDocument();
    fireEvent.click(rescanButton!);
    expect(rescanSelectedKitsMock).toHaveBeenCalled();
  });

  test("should handle close button click", () => {
    (useValidationResults as jest.Mock).mockReturnValue(mockInvalidResults);

    render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    // Find the close button by its aria-label
    const closeButtons = screen.getAllByLabelText("Close");
    const closeButton = closeButtons[0]; // Take the first one

    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  test("should handle cancel button click", () => {
    (useValidationResults as jest.Mock).mockReturnValue(mockInvalidResults);

    render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    // Find the cancel button by role and text
    const buttons = screen.getAllByRole("button");
    const cancelButton = Array.from(buttons).find(
      (button) => button.textContent === "Cancel",
    );

    fireEvent.click(cancelButton!);
    expect(mockOnClose).toHaveBeenCalled();
  });

  test("should disable rescan button when no kits are selected", () => {
    (useValidationResults as jest.Mock).mockReturnValue({
      ...mockInvalidResults,
      selectedKits: [],
    });

    render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    // Find the button by its role and text content
    const buttons = screen.getAllByRole("button");
    const rescanButton = Array.from(buttons).find((button) =>
      button.textContent?.includes("Rescan Selected Kits"),
    );

    expect(rescanButton).toBeDisabled();
    expect(rescanButton).toHaveClass("cursor-not-allowed");
  });

  test("should show rescanning state", () => {
    (useValidationResults as jest.Mock).mockReturnValue({
      ...mockInvalidResults,
      selectedKits: ["A1"],
      isRescanning: true,
    });

    const { container } = render(
      <ValidationResultsDialog
        isOpen={true}
        localStorePath={mockLocalStorePath}
        onClose={mockOnClose}
        onMessage={mockOnMessage}
      />,
    );

    expect(screen.getByText("Rescanning...")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
