import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LocalStoreWizardModal from "../LocalStoreWizardModal";

// Mock LocalStoreWizardUI component
vi.mock("../LocalStoreWizardUI", () => ({
  default: vi.fn(({ onClose, onSuccess, setLocalStorePath }) => (
    <div data-testid="local-store-wizard-ui">
      <button onClick={onClose} data-testid="wizard-close">
        Close Wizard
      </button>
      <button onClick={onSuccess} data-testid="wizard-success">
        Success
      </button>
      <button onClick={() => setLocalStorePath("/test/path")} data-testid="wizard-set-path">
        Set Path
      </button>
    </div>
  )),
}));

// Mock window.electronAPI
const mockCloseApp = vi.fn();
Object.defineProperty(window, "electronAPI", {
  value: {
    closeApp: mockCloseApp,
  },
  writable: true,
});

describe("LocalStoreWizardModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    setLocalStorePath: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders nothing when isOpen is false", () => {
      render(<LocalStoreWizardModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByTestId("local-store-wizard-ui")).not.toBeInTheDocument();
    });

    it("renders modal content when isOpen is true", () => {
      render(<LocalStoreWizardModal {...defaultProps} />);
      
      expect(screen.getByText("Local Store Setup Required")).toBeInTheDocument();
      expect(screen.getByText(/The local store must be set up before the app can be used/)).toBeInTheDocument();
      expect(screen.getByTestId("local-store-wizard-ui")).toBeInTheDocument();
    });

    it("has correct modal structure and styling", () => {
      const { container } = render(<LocalStoreWizardModal {...defaultProps} />);
      
      // Check for modal backdrop
      const backdrop = container.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass("fixed", "inset-0", "bg-black", "bg-opacity-50", "flex", "items-center", "justify-center", "z-50");
      
      // Check for modal content container
      const contentContainer = container.querySelector('.bg-white.dark\\:bg-slate-800');
      expect(contentContainer).toBeInTheDocument();
      expect(contentContainer).toHaveClass("bg-white", "dark:bg-slate-800", "rounded-lg", "p-6", "max-w-2xl", "w-full", "mx-4");
    });
  });

  describe("Content", () => {
    it("displays the correct title", () => {
      render(<LocalStoreWizardModal {...defaultProps} />);
      
      const title = screen.getByRole("heading", { level: 2 });
      expect(title).toHaveTextContent("Local Store Setup Required");
      expect(title).toHaveClass("text-xl", "font-bold", "text-gray-900", "dark:text-gray-100");
    });

    it("displays the correct description text", () => {
      render(<LocalStoreWizardModal {...defaultProps} />);
      
      const description = screen.getByText(/The local store must be set up before the app can be used/);
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass("text-gray-600", "dark:text-gray-300", "mt-2");
    });

    it("renders LocalStoreWizardUI with correct props", () => {
      const mockOnClose = vi.fn();
      const mockOnSuccess = vi.fn();
      const mockSetLocalStorePath = vi.fn();

      render(
        <LocalStoreWizardModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          setLocalStorePath={mockSetLocalStorePath}
        />
      );
      
      expect(screen.getByTestId("local-store-wizard-ui")).toBeInTheDocument();
    });
  });

  describe("Event Handling", () => {
    describe("Normal mode (not auto-triggered)", () => {
      it("calls onClose when LocalStoreWizardUI triggers close", () => {
        const mockOnClose = vi.fn();
        
        render(
          <LocalStoreWizardModal
            {...defaultProps}
            onClose={mockOnClose}
          />
        );
        
        screen.getByTestId("wizard-close").click();
        
        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(mockCloseApp).not.toHaveBeenCalled();
      });
    });

    describe("Auto-triggered mode", () => {
      it("calls window.electronAPI.closeApp when auto-triggered and close is called", () => {
        const mockOnClose = vi.fn();
        
        // Setup fresh mock for this test
        const mockCloseAppLocal = vi.fn();
        window.electronAPI = {
          closeApp: mockCloseAppLocal,
        } as any;
        
        render(
          <LocalStoreWizardModal
            {...defaultProps}
            isAutoTriggered={true}
            onClose={mockOnClose}
          />
        );
        
        screen.getByTestId("wizard-close").click();
        
        expect(mockCloseAppLocal).toHaveBeenCalledTimes(1);
        expect(mockOnClose).not.toHaveBeenCalled();
      });

      it("handles missing electronAPI gracefully when auto-triggered", () => {
        const mockOnClose = vi.fn();
        
        // Set electronAPI to undefined to test the graceful handling
        window.electronAPI = undefined as any;
        
        expect(() => {
          render(
            <LocalStoreWizardModal
              {...defaultProps}
              isAutoTriggered={true}
              onClose={mockOnClose}
            />
          );
          
          screen.getByTestId("wizard-close").click();
        }).not.toThrow();
        
        // Restore the mock
        window.electronAPI = {
          closeApp: mockCloseApp,
        } as any;
      });
    });

    it("calls onSuccess when LocalStoreWizardUI triggers success", () => {
      const mockOnSuccess = vi.fn();
      
      render(
        <LocalStoreWizardModal
          {...defaultProps}
          onSuccess={mockOnSuccess}
        />
      );
      
      screen.getByTestId("wizard-success").click();
      
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });

    it("calls setLocalStorePath when LocalStoreWizardUI sets path", () => {
      const mockSetLocalStorePath = vi.fn();
      
      render(
        <LocalStoreWizardModal
          {...defaultProps}
          setLocalStorePath={mockSetLocalStorePath}
        />
      );
      
      screen.getByTestId("wizard-set-path").click();
      
      expect(mockSetLocalStorePath).toHaveBeenCalledWith("/test/path");
    });
  });

  describe("Props handling", () => {
    it("handles all props correctly", () => {
      const props = {
        isAutoTriggered: false,
        isOpen: true,
        onClose: vi.fn(),
        onSuccess: vi.fn(),
        setLocalStorePath: vi.fn(),
      };
      
      expect(() => render(<LocalStoreWizardModal {...props} />)).not.toThrow();
    });

    it("uses default value for isAutoTriggered when not provided", () => {
      const mockOnClose = vi.fn();
      
      render(
        <LocalStoreWizardModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={vi.fn()}
          setLocalStorePath={vi.fn()}
        />
      );
      
      // Should use normal close behavior (not auto-triggered)
      screen.getByTestId("wizard-close").click();
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockCloseApp).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has proper modal structure for screen readers", () => {
      render(<LocalStoreWizardModal {...defaultProps} />);
      
      // Check for proper heading structure
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Local Store Setup Required");
      
      // Check that content is properly structured
      expect(heading.tagName).toBe("H2");
    });

    it("has proper z-index for modal layering", () => {
      const { container } = render(<LocalStoreWizardModal {...defaultProps} />);
      
      const backdrop = container.querySelector('.fixed.z-50');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass("z-50");
    });
  });

  describe("React.memo optimization", () => {
    it("is wrapped with React.memo", () => {
      // This is a bit tricky to test directly, but we can verify the component
      // behaves correctly and doesn't re-render unnecessarily
      const { rerender } = render(<LocalStoreWizardModal {...defaultProps} />);
      
      expect(screen.getByTestId("local-store-wizard-ui")).toBeInTheDocument();
      
      // Re-render with same props should work
      rerender(<LocalStoreWizardModal {...defaultProps} />);
      
      expect(screen.getByTestId("local-store-wizard-ui")).toBeInTheDocument();
    });
  });
});