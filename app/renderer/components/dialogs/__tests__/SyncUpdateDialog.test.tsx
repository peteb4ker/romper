import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SyncUpdateDialog, { type SyncChangeSummary } from "../SyncUpdateDialog";

describe("SyncUpdateDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockChangeSummary: SyncChangeSummary = {
    estimatedSize: 2048000, // 2MB
    estimatedTime: 30,
    filesToConvert: [
      {
        destinationPath: "/sd/A0/snare.wav",
        filename: "snare.wav",
        operation: "convert",
        originalFormat: "24-bit 48kHz",
        reason: "Bit depth and sample rate conversion required",
        sourcePath: "/path/to/snare.wav",
        targetFormat: "16-bit 44.1kHz",
      },
    ],
    filesToCopy: [
      {
        destinationPath: "/sd/A0/kick.wav",
        filename: "kick.wav",
        operation: "copy",
        sourcePath: "/path/to/kick.wav",
      },
    ],
    hasFormatWarnings: true,
    validationErrors: [],
    warnings: ["snare.wav needs bit depth conversion"],
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
          changeSummary={mockChangeSummary}
          isOpen={false}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.queryByText("Sync All Kits to SD Card"),
      ).not.toBeInTheDocument();
    });
  });

  describe("when dialog is open", () => {
    it("should render dialog with kit name and summary stats", () => {
      render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("Sync All Kits to SD Card")).toBeInTheDocument();
      expect(screen.getByText("Kit A0")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument(); // Total files
      expect(screen.getByText("2 MB")).toBeInTheDocument(); // File size
      expect(screen.getByText("30s")).toBeInTheDocument(); // Estimated time
    });

    it("should display format warnings when present", () => {
      render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.getAllByText("Format Conversion Required").length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText("snare.wav needs bit depth conversion").length,
      ).toBeGreaterThan(0);
    });

    it("should show operation summary", () => {
      render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.getByText("1 file(s) will be copied directly"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("1 file(s) will be converted during copy"),
      ).toBeInTheDocument();
    });

    it("should toggle details when Show Details is clicked", async () => {
      const user = userEvent.setup();

      render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const showDetailsButton = screen.getByText("Show Details");
      await user.click(showDetailsButton);

      expect(screen.getByText("Files to Copy")).toBeInTheDocument();
      expect(screen.getByText("Files to Convert")).toBeInTheDocument();
      expect(screen.getByText("kick.wav")).toBeInTheDocument();
      expect(screen.getByText("snare.wav")).toBeInTheDocument();

      await user.click(screen.getByText("Hide Details"));
      expect(screen.queryByText("Files to Copy")).not.toBeInTheDocument();
    });

    it("should call onClose when Cancel button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await user.click(screen.getByText("Cancel"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onConfirm when Start Sync button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await user.click(screen.getByText("Start Sync"));
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("should disable buttons when loading", () => {
      render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isLoading={true}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("Cancel")).toBeDisabled();
      expect(screen.getByText("Syncing...")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close sync dialog/i }),
      ).toBeDisabled();
    });

    it("should disable Start Sync when no files to sync", () => {
      const emptyChangeSummary: SyncChangeSummary = {
        estimatedSize: 0,
        estimatedTime: 0,
        filesToConvert: [],
        filesToCopy: [],
        hasFormatWarnings: false,
        validationErrors: [],
        warnings: [],
      };

      render(
        <SyncUpdateDialog
          changeSummary={emptyChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("Start Sync")).toBeDisabled();
      expect(screen.getByText("No changes to sync")).toBeInTheDocument();
    });

    it("should display validation errors and disable sync", () => {
      const errorChangeSummary: SyncChangeSummary = {
        estimatedSize: 1024000,
        estimatedTime: 10,
        filesToConvert: [],
        filesToCopy: [
          {
            destinationPath: "/sd/A0/kick.wav",
            filename: "kick.wav",
            operation: "copy",
            sourcePath: "/path/to/kick.wav",
          },
        ],
        hasFormatWarnings: false,
        validationErrors: [
          {
            error: "File not found",
            filename: "missing.wav",
            sourcePath: "/path/to/missing.wav",
            type: "missing_file",
          },
          {
            error: "Access denied",
            filename: "locked.wav",
            sourcePath: "/path/to/locked.wav",
            type: "access_denied",
          },
        ],
        warnings: [],
      };

      render(
        <SyncUpdateDialog
          changeSummary={errorChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("Sync Cannot Proceed")).toBeInTheDocument();
      expect(
        screen.getByText("The following files cannot be accessed:"),
      ).toBeInTheDocument();
      expect(screen.getByText("missing.wav")).toBeInTheDocument();
      expect(screen.getByText("/path/to/missing.wav")).toBeInTheDocument();
      expect(screen.getByText("File not found")).toBeInTheDocument();
      expect(screen.getByText("locked.wav")).toBeInTheDocument();
      expect(screen.getByText("Access denied")).toBeInTheDocument();

      expect(screen.getByText("Start Sync")).toBeDisabled();
      expect(
        screen.getByText("Cannot sync - 2 files missing"),
      ).toBeInTheDocument();
    });

    it("should handle single validation error", () => {
      const singleErrorChangeSummary: SyncChangeSummary = {
        estimatedSize: 0,
        estimatedTime: 0,
        filesToConvert: [],
        filesToCopy: [],
        hasFormatWarnings: false,
        validationErrors: [
          {
            error: "File not found",
            filename: "missing.wav",
            sourcePath: "/path/to/missing.wav",
            type: "missing_file",
          },
        ],
        warnings: [],
      };

      render(
        <SyncUpdateDialog
          changeSummary={singleErrorChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.getByText("Cannot sync - 1 file missing"),
      ).toBeInTheDocument();
    });

    it("should format file sizes correctly", () => {
      const largeSizeChangeSummary: SyncChangeSummary = {
        ...mockChangeSummary,
        estimatedSize: 1073741824, // 1GB
        validationErrors: [],
      };

      render(
        <SyncUpdateDialog
          changeSummary={largeSizeChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("1 GB")).toBeInTheDocument();
    });

    it("should format time correctly for minutes", () => {
      const longTimeChangeSummary: SyncChangeSummary = {
        ...mockChangeSummary,
        estimatedTime: 150, // 2m 30s
        validationErrors: [],
      };

      render(
        <SyncUpdateDialog
          changeSummary={longTimeChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(screen.getByText("2m 30s")).toBeInTheDocument();
    });

    it("should reset details view when dialog opens", () => {
      const { rerender } = render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={false}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      // Open dialog and show details
      rerender(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      // Details should be hidden initially
      expect(screen.getByText("Show Details")).toBeInTheDocument();
      expect(screen.queryByText("Files to Copy")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper aria labels", () => {
      render(
        <SyncUpdateDialog
          changeSummary={mockChangeSummary}
          isOpen={true}
          kitName="A0"
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(
        screen.getByRole("button", { name: /close sync dialog/i }),
      ).toBeInTheDocument();
    });
  });
});
