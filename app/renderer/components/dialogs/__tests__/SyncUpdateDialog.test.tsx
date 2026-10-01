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
    removals: [],
    validationErrors: [],
    warnings: [],
  };

  const summaryWithInvalidFiles: SyncChangeSummary = {
    ...mockChangeSummary,
    validationErrors: [
      {
        error: "Source file not found: /samples/missing.wav",
        filename: "missing.wav",
        kitName: "A1",
        sourcePath: "/samples/missing.wav",
        type: "missing_file",
      },
    ],
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

    it("lists what sync will remove from the card", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={{
            ...mockChangeSummary,
            removals: ["A0/1-02 old.wav", "B3"],
          }}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          sdCardPath="/Volumes/RAMPLE"
        />,
      );

      const removals = screen.getByTestId("card-removals");
      expect(removals).toHaveTextContent(
        "2 items no longer in your library will be removed from the card",
      );
      expect(removals).toHaveTextContent("A0/1-02 old.wav");
      expect(removals).toHaveTextContent("B3");
    });

    it("shows no removals when the card has nothing stale", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={mockChangeSummary}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.queryByTestId("card-removals")).not.toBeInTheDocument();
    });

    it("summarizes against the card, again when the user picks another", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onGenerate = vi.fn().mockResolvedValue(mockChangeSummary);
      vi.mocked(globalThis.electronAPI.selectSdCard).mockResolvedValueOnce(
        "/Volumes/OTHER",
      );

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={null}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          onGenerateChangeSummary={onGenerate}
          sdCardPath="/Volumes/RAMPLE"
        />,
      );
      await waitFor(() =>
        expect(onGenerate).toHaveBeenCalledWith("/Volumes/RAMPLE"),
      );

      await user.click(screen.getByTestId("select-sd-card"));

      await waitFor(() =>
        expect(onGenerate).toHaveBeenLastCalledWith("/Volumes/OTHER"),
      );
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
        skipInvalidFiles: false,
      });
    });

    describe("with samples that can't be written", () => {
      it("lists them and blocks the write until the user agrees to skip them", async () => {
        const user = userEvent.setup({
          advanceTimers: vi.advanceTimersByTime,
        });

        render(
          <SyncUpdateDialog
            isOpen={true}
            kitName="A0"
            localChangeSummary={summaryWithInvalidFiles}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
            sdCardPath="/path/to/sd"
          />,
        );

        const invalidFiles = screen.getByTestId("invalid-files");
        expect(invalidFiles).toHaveTextContent("1 sample can't be written");
        expect(invalidFiles).toHaveTextContent("A1");
        expect(invalidFiles).toHaveTextContent("missing.wav");
        expect(invalidFiles).toHaveTextContent(
          "Source file not found: /samples/missing.wav",
        );
        expect(screen.getByTestId("confirm-sync")).toBeDisabled();

        await user.click(screen.getByTestId("skip-invalid-files-checkbox"));
        expect(screen.getByTestId("confirm-sync")).not.toBeDisabled();

        await user.click(screen.getByTestId("confirm-sync"));
        expect(mockOnConfirm).toHaveBeenCalledWith({
          sdCardPath: "/path/to/sd",
          skipInvalidFiles: true,
        });
      });

      it("shows how many were skipped once the write completes", () => {
        render(
          <SyncUpdateDialog
            isOpen={true}
            kitName="A0"
            localChangeSummary={summaryWithInvalidFiles}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
            sdCardPath="/path/to/sd"
            syncProgress={{
              bytesCompleted: 0,
              currentFile: "",
              filesCompleted: 15,
              status: "completed",
              totalBytes: 0,
              totalFiles: 15,
            }}
          />,
        );

        expect(screen.getByTestId("skipped-count")).toHaveTextContent(
          "1 skipped",
        );
      });
    });

    it("shows sync warnings", () => {
      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          localChangeSummary={{
            ...mockChangeSummary,
            warnings: [
              'Stereo sample "pad.wav" on voice 1 will play across voices 1 and 2',
            ],
          }}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByTestId("sync-warnings")).toHaveTextContent(
        'Stereo sample "pad.wav" on voice 1',
      );
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
  });

  describe("summary generation failure", () => {
    it("shows a distinct error when summary generation returns null", async () => {
      const onGenerate = vi.fn().mockResolvedValue(null);

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          onGenerateChangeSummary={onGenerate}
          sdCardPath="/sd"
        />,
      );

      const banner = await screen.findByTestId("summary-error");
      expect(banner).toHaveTextContent(/could not scan kits/i);

      // Confirm must be disabled — no summary, so no write
      expect(screen.getByTestId("confirm-sync")).toBeDisabled();
    });

    it("shows the failure reason when summary generation throws", async () => {
      const onGenerate = vi.fn().mockRejectedValue(new Error("SD unmounted"));

      render(
        <SyncUpdateDialog
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          onGenerateChangeSummary={onGenerate}
          sdCardPath="/sd"
        />,
      );

      const banner = await screen.findByTestId("summary-error");
      expect(banner).toHaveTextContent("SD unmounted");
      expect(screen.getByTestId("confirm-sync")).toBeDisabled();
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
