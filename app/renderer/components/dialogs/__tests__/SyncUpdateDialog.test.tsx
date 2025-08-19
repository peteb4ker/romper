import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SyncUpdateDialog, { type SyncChangeSummary } from "../SyncUpdateDialog";

describe("SyncUpdateDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockChangeSummary: SyncChangeSummary = {
    fileCount: 15,
    kitCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
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
        />
      );

      expect(
        screen.queryByText("Sync All Kits to SD Card")
      ).not.toBeInTheDocument();
    });
  });

  describe("when dialog is open", () => {
    it("should render dialog with kit name and summary stats", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText("Sync All Kits to SD Card")).toBeInTheDocument();
      expect(screen.getByText("2 kits, 15 samples")).toBeInTheDocument();
      expect(screen.getByText("Ready to sync")).toBeInTheDocument();
    });

    it("should display clear SD card option", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText("Clear SD card before sync")).toBeInTheDocument();
      expect(screen.getByTestId("wipe-sd-card-checkbox")).toBeInTheDocument();
    });

    it("should require SD card selection before sync", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const startSyncButton = screen.getByText("Start Sync");
      expect(startSyncButton).toBeDisabled();

      expect(screen.getByText("No SD card selected")).toBeInTheDocument();
    });

    it("should enable sync when SD card is selected", async () => {
      const user = userEvent.setup();

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/path/to/sd"
        />
      );

      const startSyncButton = screen.getByText("Start Sync");
      expect(startSyncButton).not.toBeDisabled();

      await user.click(startSyncButton);
      expect(mockOnConfirm).toHaveBeenCalledWith({
        sdCardPath: "/path/to/sd",
        wipeSdCard: false,
      });
    });

    it("should call onClose when Cancel button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      await user.click(screen.getByText("Cancel"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should handle wipe SD card option", async () => {
      const user = userEvent.setup();

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/path/to/sd"
        />
      );

      const wipeCheckbox = screen.getByTestId("wipe-sd-card-checkbox");
      await user.click(wipeCheckbox);

      await user.click(screen.getByText("Start Sync"));
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
        />
      );

      expect(screen.getByText("Cancel")).toBeDisabled();
      expect(screen.getByText("Syncing...")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close sync dialog/i })
      ).toBeDisabled();
    });

    it("should disable Start Sync when no files to sync", () => {
      const emptyChangeSummary: SyncChangeSummary = {
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
        />
      );

      expect(screen.getByText("Start Sync")).toBeDisabled();
      expect(screen.getByText("0 kits, 0 samples")).toBeInTheDocument();
    });

    it("should show progress during sync", () => {
      const mockSyncProgress = {
        bytesCompleted: 1024,
        currentFile: "kick.wav",
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
        />
      );

      expect(screen.getByText("Copying files...")).toBeInTheDocument();
      expect(screen.getByText("1 / 2 files")).toBeInTheDocument();
      expect(screen.getByText("kick.wav")).toBeInTheDocument();
    });

    it("should show success message when sync completes", () => {
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
        />
      );

      expect(screen.getByText("Sync Complete!")).toBeInTheDocument();
      expect(
        screen.getByText("Successfully synced 15 files to SD card")
      ).toBeInTheDocument();
    });

    it("should show SD card selection button", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
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
        />
      );

      const selectButton = screen.getByTestId("select-sd-card");
      expect(selectButton).toHaveTextContent("Change");
      expect(screen.getByTestId("sd-card-path")).toHaveTextContent(
        "/path/to/sd"
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
        />
      );

      // Open dialog
      rerender(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      // Wipe option should be unchecked initially
      const wipeCheckbox = screen.getByTestId(
        "wipe-sd-card-checkbox"
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
        />
      );

      expect(screen.getAllByText("Sync Failed")).toHaveLength(1); // Only error section now
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
      expect(screen.getByText("problematic_file.wav")).toBeInTheDocument();
      expect(screen.getByText("Copying file")).toBeInTheDocument();
      expect(screen.getByText("💡 What to do:")).toBeInTheDocument();
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
        />
      );

      expect(screen.getByTestId("retry-sync")).toBeInTheDocument();
      expect(screen.getByText("Retry Sync")).toBeInTheDocument();
      expect(screen.getByText("Close")).toBeInTheDocument(); // Cancel becomes "Close"
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
        />
      );

      expect(screen.getAllByText("Sync Failed")).toHaveLength(1); // Only error section now
      expect(
        screen.getByText("Generic sync error occurred")
      ).toBeInTheDocument();
      expect(screen.getByText("Failed on file:")).toBeInTheDocument();
      expect(screen.getByText("test.wav")).toBeInTheDocument();
    });

    it("should disable start sync for non-retryable errors", () => {
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
        />
      );

      expect(screen.queryByTestId("retry-sync")).not.toBeInTheDocument();
      const startButton = screen.getByTestId("confirm-sync");
      expect(startButton).toBeDisabled();
      expect(
        screen.getByText(/This error requires attention/)
      ).toBeInTheDocument();
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
        />
      );

      expect(
        screen.getByRole("button", { name: /close sync dialog/i })
      ).toBeInTheDocument();
    });
  });
});
