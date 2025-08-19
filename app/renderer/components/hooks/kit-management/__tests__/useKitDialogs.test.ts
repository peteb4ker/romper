import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitDialogs } from "../useKitDialogs";

describe("useKitDialogs", () => {
  const mockOnMessage = vi.fn();
  const mockSetLocalStorePath = vi.fn();

  const defaultProps = {
    onMessage: mockOnMessage,
    setLocalStorePath: mockSetLocalStorePath,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("initializes with correct default values", () => {
      const { result } = renderHook(() => useKitDialogs(defaultProps));

      expect(result.current.showLocalStoreWizard).toBe(false);
      expect(result.current.showValidationDialog).toBe(false);
    });
  });

  describe("local store wizard", () => {
    it("shows and hides local store wizard", () => {
      const { result } = renderHook(() => useKitDialogs(defaultProps));

      expect(result.current.showLocalStoreWizard).toBe(false);

      act(() => {
        result.current.handleShowLocalStoreWizard();
      });

      expect(result.current.showLocalStoreWizard).toBe(true);

      act(() => {
        result.current.handleCloseLocalStoreWizard();
      });

      expect(result.current.showLocalStoreWizard).toBe(false);
    });

    it("handles successful local store setup", () => {
      const { result } = renderHook(() => useKitDialogs(defaultProps));

      act(() => {
        result.current.handleShowLocalStoreWizard();
      });

      expect(result.current.showLocalStoreWizard).toBe(true);

      act(() => {
        result.current.handleLocalStoreSuccess();
      });

      expect(result.current.showLocalStoreWizard).toBe(false);
      expect(mockOnMessage).toHaveBeenCalledWith(
        "Local store initialized successfully!",
        "success",
        5000
      );
    });

    it("provides correct props for LocalStoreWizardUI", () => {
      const { result } = renderHook(() => useKitDialogs(defaultProps));

      expect(result.current.localStoreWizardProps).toEqual({
        onClose: result.current.handleCloseLocalStoreWizard,
        onSuccess: result.current.handleLocalStoreSuccess,
        setLocalStorePath: mockSetLocalStorePath,
      });
    });

    it("handles undefined setLocalStorePath", () => {
      const { result } = renderHook(() =>
        useKitDialogs({ ...defaultProps, setLocalStorePath: undefined })
      );

      expect(
        typeof result.current.localStoreWizardProps.setLocalStorePath
      ).toBe("function");

      // Should not throw when called
      expect(() => {
        result.current.localStoreWizardProps.setLocalStorePath("test");
      }).not.toThrow();
    });
  });

  describe("validation dialog", () => {
    it("shows and hides validation dialog", () => {
      const { result } = renderHook(() => useKitDialogs(defaultProps));

      expect(result.current.showValidationDialog).toBe(false);

      act(() => {
        result.current.handleShowValidationDialog();
      });

      expect(result.current.showValidationDialog).toBe(true);

      act(() => {
        result.current.handleCloseValidationDialog();
      });

      expect(result.current.showValidationDialog).toBe(false);
    });
  });

  describe("without onMessage callback", () => {
    it("handles success without onMessage callback", () => {
      const { result } = renderHook(() =>
        useKitDialogs({
          onMessage: undefined,
          setLocalStorePath: mockSetLocalStorePath,
        })
      );

      expect(() => {
        act(() => {
          result.current.handleLocalStoreSuccess();
        });
      }).not.toThrow();

      expect(result.current.showLocalStoreWizard).toBe(false);
    });
  });
});
