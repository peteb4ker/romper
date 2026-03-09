import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SyncUpdateDialog, { type SyncChangeSummary } from "../SyncUpdateDialog";

describe("SyncUpdateDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockChangeSummary: SyncChangeSummary = {
    banks: [
      { bank: "A", fileCount: 8, hasConversions: false, kitCount: 5 },
      { bank: "B", fileCount: 7, hasConversions: true, kitCount: 3 },
    ],
    fileCount: 15,
    kitCount: 8,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe("when dialog is closed", () => {
    it("should not render when isOpen is false", () => {
      render(
        <SyncUpdateDialog
          isOpen={false}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.queryByText("Write to SD Card")).not.toBeInTheDocument();
    });
  });

  describe("when dialog is open", () => {
    it("should render panel with title", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("Write to SD Card")).toBeInTheDocument();
    });

    it("should render bank summary table with totals", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByTestId("bank-summary")).toBeInTheDocument();
      // Column headers
      expect(screen.getByText("Bank")).toBeInTheDocument();
      expect(screen.getByText("Kits")).toBeInTheDocument();
      expect(screen.getByText("Samples")).toBeInTheDocument();
      // Bank rows
      expect(screen.getByTestId("bank-A")).toBeInTheDocument();
      expect(screen.getByTestId("bank-B")).toBeInTheDocument();
      expect(screen.getByTestId("bank-A")).toHaveTextContent("5");
      expect(screen.getByTestId("bank-A")).toHaveTextContent("8");
      expect(screen.getByTestId("bank-B")).toHaveTextContent("3");
      expect(screen.getByTestId("bank-B")).toHaveTextContent("7");
      // Totals row
      expect(screen.getByTestId("total-kits")).toHaveTextContent("8");
      expect(screen.getByTestId("total-samples")).toHaveTextContent("15");
    });

    it("should show conversion indicator for banks needing conversion", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      // Bank B has conversions, shown as "convert" in its row
      expect(screen.getByText("convert")).toBeInTheDocument();
    });

    it("should display wipe SD card option", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.getByText("Clear SD card before writing"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("wipe-sd-card-checkbox")).toBeInTheDocument();
    });

    it("should require SD card selection before writing", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startSyncButton = screen.getByText("Start Write");
      expect(startSyncButton).toBeDisabled();
      expect(screen.getByText("No SD card selected")).toBeInTheDocument();
    });

    it("should enable write when SD card is selected", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/path/to/sd"
        />,
      );

      const startSyncButton = screen.getByText("Start Write");
      expect(startSyncButton).not.toBeDisabled();

      await user.click(startSyncButton);
      expect(mockOnConfirm).toHaveBeenCalledWith({
        sdCardPath: "/path/to/sd",
        wipeSdCard: false,
      });
    });

    it("should call onClose when Cancel button is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await user.click(screen.getByText("Cancel"));
      vi.advanceTimersByTime(250);
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle wipe SD card option", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/path/to/sd"
        />,
      );

      const wipeCheckbox = screen.getByTestId("wipe-sd-card-checkbox");
      await user.click(wipeCheckbox);

      await user.click(screen.getByText("Start Write"));
      expect(mockOnConfirm).toHaveBeenCalledWith({
        sdCardPath: "/path/to/sd",
        wipeSdCard: true,
      });
    });

    it("should disable buttons when loading", () => {
      render(
        <SyncUpdateDialog
          isLoading={true}
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("Cancel")).toBeDisabled();
      expect(screen.getByText("Writing...")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close write dialog/i }),
      ).toBeDisabled();
    });

    it("should disable Start Write when no files to write", () => {
      const emptyChangeSummary: SyncChangeSummary = {
        banks: [],
        fileCount: 0,
        kitCount: 0,
      };

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={emptyChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/path/to/sd"
        />,
      );

      expect(screen.getByText("Start Write")).toBeDisabled();
      // No bank table shown when empty
      expect(screen.queryByTestId("bank-summary")).not.toBeInTheDocument();
    });

    it("should show progress during sync", () => {
      const mockSyncProgress = {
        bytesCompleted: 1024,
        currentFile: "kick.wav",
        currentKitName: "A0",
        filesCompleted: 1,
        status: "copying" as const,
        totalBytes: 2048,
        totalFiles: 2,
      };

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/path/to/sd"
          syncProgress={mockSyncProgress}
        />,
      );

      expect(screen.getByTestId("current-kit-name")).toHaveTextContent("A0");
      expect(screen.getByText("1/2")).toBeInTheDocument();
    });

    it("should show success message when write completes", () => {
      const mockSyncProgress = {
        bytesCompleted: 2048,
        currentFile: "",
        filesCompleted: 15,
        status: "completed" as const,
        totalBytes: 2048,
        totalFiles: 15,
      };

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/path/to/sd"
          syncProgress={mockSyncProgress}
        />,
      );

      expect(screen.getByText("Write Complete")).toBeInTheDocument();
    });

    it("should show SD card selection button", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const selectButton = screen.getByTestId("select-sd-card");
      expect(selectButton).toBeInTheDocument();
      expect(selectButton).toHaveTextContent("Select");
    });

    it("should show Change button when SD card is selected", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/path/to/sd"
        />,
      );

      const selectButton = screen.getByTestId("select-sd-card");
      expect(selectButton).toHaveTextContent("Change");
      expect(screen.getByTestId("sd-card-path")).toHaveTextContent(
        "/path/to/sd",
      );
    });

    it("should reset wipe option when dialog opens", () => {
      const { rerender } = render(
        <SyncUpdateDialog
          isOpen={false}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      rerender(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const wipeCheckbox = screen.getByTestId(
        "wipe-sd-card-checkbox",
      ) as HTMLInputElement;
      expect(wipeCheckbox.checked).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should show detailed error message with error details", () => {
      const mockSyncProgressWithError = {
        bytesCompleted: 100,
        currentFile: "test.wav",
        errorDetails: {
          canRetry: true,
          error: "Permission denied",
          fileName: "problematic_file.wav",
          operation: "copy" as const,
        },
        filesCompleted: 1,
        status: "error" as const,
        totalBytes: 200,
        totalFiles: 2,
      };

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          syncProgress={mockSyncProgressWithError}
        />,
      );

      expect(screen.getAllByText("Write Failed")).toHaveLength(1);
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
      expect(screen.getByText("problematic_file.wav")).toBeInTheDocument();
    });

    it("should show retry button for retryable errors", () => {
      const mockSyncProgressWithRetryableError = {
        bytesCompleted: 100,
        currentFile: "test.wav",
        errorDetails: {
          canRetry: true,
          error: "Temporary network error",
          fileName: "test.wav",
          operation: "copy" as const,
        },
        filesCompleted: 1,
        status: "error" as const,
        totalBytes: 200,
        totalFiles: 2,
      };

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          syncProgress={mockSyncProgressWithRetryableError}
        />,
      );

      expect(screen.getByTestId("retry-sync")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    it("should show generic error message when no error details", () => {
      const mockSyncProgressWithGenericError = {
        bytesCompleted: 100,
        currentFile: "test.wav",
        error: "Generic sync error occurred",
        filesCompleted: 1,
        status: "error" as const,
        totalBytes: 200,
        totalFiles: 2,
      };

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          syncProgress={mockSyncProgressWithGenericError}
        />,
      );

      expect(screen.getAllByText("Write Failed")).toHaveLength(1);
      expect(
        screen.getByText(/Generic sync error occurred/),
      ).toBeInTheDocument();
    });

    it("should disable start write for non-retryable errors", () => {
      const mockSyncProgressWithNonRetryableError = {
        bytesCompleted: 100,
        currentFile: "test.wav",
        errorDetails: {
          canRetry: false,
          error: "File corrupted",
          fileName: "corrupt.wav",
          operation: "convert" as const,
        },
        filesCompleted: 1,
        status: "error" as const,
        totalBytes: 200,
        totalFiles: 2,
      };

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/test/path"
          syncProgress={mockSyncProgressWithNonRetryableError}
        />,
      );

      expect(screen.queryByTestId("retry-sync")).not.toBeInTheDocument();
      const startButton = screen.getByTestId("confirm-sync");
      expect(startButton).toBeDisabled();
    });
  });

  describe("accessibility", () => {
    it("should have proper aria labels", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.getByRole("button", { name: /close write dialog/i }),
      ).toBeInTheDocument();
    });
  });
});
