import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AboutDialog from "../AboutDialog";

// Mock the electron API
const mockOpenExternal = vi.fn();
Object.defineProperty(window, "electronAPI", {
  value: {
    openExternal: mockOpenExternal,
  },
  writable: true,
});

// Mock import.meta.env
Object.defineProperty(import.meta, "env", {
  value: {
    VITE_APP_VERSION: "1.0.0-test",
  },
  writable: true,
});

describe("AboutDialog", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock function
    window.electronAPI.openExternal = mockOpenExternal;
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders when isOpen is true", () => {
      render(<AboutDialog {...defaultProps} />);
      
      expect(screen.getByText("About Romper")).toBeInTheDocument();
      expect(screen.getByText("Rample SD Card Manager")).toBeInTheDocument();
      expect(screen.getByText("Romper")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      render(<AboutDialog {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText("About Romper")).not.toBeInTheDocument();
    });

    it("displays version information", () => {
      render(<AboutDialog {...defaultProps} />);
      
      expect(screen.getByText(/Version:/)).toBeInTheDocument();
      // The component uses fallback "dev" when no version is set
      expect(screen.getByText("dev")).toBeInTheDocument();
    });

    it("displays copyright information with current year", () => {
      const currentYear = new Date().getFullYear();
      render(<AboutDialog {...defaultProps} />);
      
      expect(screen.getByText(`© Pete Baker ${currentYear}`)).toBeInTheDocument();
    });

    it("displays disclaimer about Squarp SAS", () => {
      render(<AboutDialog {...defaultProps} />);
      
      expect(screen.getByText("This application is")).toBeInTheDocument();
      expect(screen.getByText("not affiliated with Squarp SAS")).toBeInTheDocument();
    });

    it("displays MIT license information", () => {
      render(<AboutDialog {...defaultProps} />);
      
      expect(screen.getByText("Licensed under the")).toBeInTheDocument();
      expect(screen.getByText("MIT license")).toBeInTheDocument();
    });

    it("displays open source information", () => {
      render(<AboutDialog {...defaultProps} />);
      
      expect(screen.getByText(/Romper is an/)).toBeInTheDocument();
      expect(screen.getByText("open-source")).toBeInTheDocument();
      expect(screen.getByText(/Electron app for managing Squarp Rample SD cards/)).toBeInTheDocument();
    });

    it("displays GitHub repository button", () => {
      render(<AboutDialog {...defaultProps} />);
      
      expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    });

    it("displays fallback version when VITE_APP_VERSION is not available", () => {
      render(<AboutDialog {...defaultProps} />);
      
      // Component should show "dev" as fallback when no version is set
      expect(screen.getByText("dev")).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<AboutDialog {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByLabelText("Close dialog");
      await user.click(closeButton);
      
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("calls onClose when escape key is pressed", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<AboutDialog {...defaultProps} onClose={onClose} />);
      
      await user.keyboard("{Escape}");
      
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("calls onClose when backdrop is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<AboutDialog {...defaultProps} onClose={onClose} />);
      
      const backdrop = screen.getByRole("dialog");
      await user.click(backdrop);
      
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("does not call onClose when clicking inside dialog content", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<AboutDialog {...defaultProps} onClose={onClose} />);
      
      const title = screen.getByText("About Romper");
      await user.click(title);
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("external links", () => {
    it("opens GitHub repository when button is clicked", async () => {
      const user = userEvent.setup();
      
      render(<AboutDialog {...defaultProps} />);
      
      const githubButton = screen.getByRole("button", { name: /GitHub Repository/i });
      await user.click(githubButton);
      
      expect(mockOpenExternal).toHaveBeenCalledWith("https://github.com/peteb4ker/romper/");
    });

    it("opens MIT license link when clicked", async () => {
      const user = userEvent.setup();
      
      render(<AboutDialog {...defaultProps} />);
      
      const licenseButton = screen.getByRole("button", { name: /MIT license/i });
      await user.click(licenseButton);
      
      expect(mockOpenExternal).toHaveBeenCalledWith("https://opensource.org/licenses/MIT");
    });

    it("falls back to window.open when electronAPI.openExternal is not available", async () => {
      const user = userEvent.setup();
      
      // Mock window.open
      const mockWindowOpen = vi.fn();
      Object.defineProperty(window, "open", {
        value: mockWindowOpen,
        writable: true,
      });

      // Temporarily remove electronAPI.openExternal
      const originalElectronAPI = window.electronAPI;
      Object.defineProperty(window, "electronAPI", {
        value: {},
        writable: true,
      });
      
      render(<AboutDialog {...defaultProps} />);
      
      const githubButton = screen.getByText("GitHub Repository");
      await user.click(githubButton);
      
      expect(mockWindowOpen).toHaveBeenCalledWith(
        "https://github.com/peteb4ker/romper/",
        "_blank",
        "noopener,noreferrer"
      );

      // Restore original electronAPI
      Object.defineProperty(window, "electronAPI", {
        value: originalElectronAPI,
        writable: true,
      });
    });
  });

  describe("accessibility", () => {
    it("has correct ARIA attributes", () => {
      render(<AboutDialog {...defaultProps} />);
      
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "about-title");
      expect(dialog).toHaveAttribute("tabIndex", "-1");
    });

    it("has proper heading structure", () => {
      render(<AboutDialog {...defaultProps} />);
      
      const mainHeading = screen.getByRole("heading", { level: 2 });
      expect(mainHeading).toHaveTextContent("About Romper");
      expect(mainHeading).toHaveAttribute("id", "about-title");

      const appNameHeading = screen.getByRole("heading", { level: 3 });
      expect(appNameHeading).toHaveTextContent("Romper");
    });

    it("close button has proper aria-label", () => {
      render(<AboutDialog {...defaultProps} />);
      
      const closeButton = screen.getByLabelText("Close dialog");
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe("styling and layout", () => {
    it("has correct CSS classes for modal overlay", () => {
      render(<AboutDialog {...defaultProps} />);
      
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveClass(
        "fixed",
        "inset-0",
        "bg-black",
        "bg-opacity-50",
        "flex",
        "items-center",
        "justify-center",
        "z-50"
      );
    });

    it("has correct CSS classes for modal content", () => {
      render(<AboutDialog {...defaultProps} />);
      
      const content = screen.getByRole("dialog").firstChild as HTMLElement;
      expect(content).toHaveClass(
        "bg-white",
        "dark:bg-slate-800",
        "rounded-lg",
        "shadow-xl",
        "w-full",
        "max-w-lg",
        "max-h-[80vh]",
        "overflow-hidden"
      );
    });
  });

  describe("keyboard navigation", () => {
    it("handles escape key when dialog is open", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      
      render(<AboutDialog {...defaultProps} onClose={onClose} />);
      
      // Escape should close the dialog
      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("does not handle escape key when dialog is closed", () => {
      const onClose = vi.fn();
      
      render(<AboutDialog {...defaultProps} isOpen={false} onClose={onClose} />);
      
      // Dialog should not be in DOM, so escape handler should not be attached
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});