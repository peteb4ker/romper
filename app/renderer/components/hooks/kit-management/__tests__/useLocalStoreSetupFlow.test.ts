import type { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useLocalStoreSetupFlow } from "../useLocalStoreSetupFlow";

// Note: vitest runs with import.meta.env.MODE === "test", so the hook's
// isTestEnvironment branch is active in all of these tests.

const makeStatus = (
  overrides: Partial<LocalStoreValidationDetailedResult>,
): LocalStoreValidationDetailedResult =>
  ({
    hasLocalStore: true,
    isValid: true,
    localStorePath: "/store",
    ...overrides,
  }) as LocalStoreValidationDetailedResult;

describe("useLocalStoreSetupFlow", () => {
  const closeWizard = vi.fn();
  const refreshLocalStoreStatus = vi.fn().mockResolvedValue(undefined);
  const setShowWizard = vi.fn();

  const render = (
    localStoreStatus: LocalStoreValidationDetailedResult | null,
    isInitialized = true,
  ) =>
    renderHook(
      (props: {
        isInitialized: boolean;
        localStoreStatus: LocalStoreValidationDetailedResult | null;
      }) =>
        useLocalStoreSetupFlow({
          closeWizard,
          isInitialized: props.isInitialized,
          localStoreStatus: props.localStoreStatus,
          refreshLocalStoreStatus,
          setShowWizard,
        }),
      { initialProps: { isInitialized, localStoreStatus } },
    );

  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock();
    refreshLocalStoreStatus.mockResolvedValue(undefined);
  });

  describe("scenario flags", () => {
    it("reports nothing before initialization or status", () => {
      const { result } = render(null, false);

      expect(result.current.needsLocalStoreSetup).toBe(false);
      expect(result.current.hasInvalidLocalStore).toBe(false);
      expect(result.current.hasCriticalEnvironmentError).toBe(false);
      expect(setShowWizard).not.toHaveBeenCalled();
    });

    it("needs setup when no local store is configured (A1-A3)", () => {
      const { result } = render(makeStatus({ hasLocalStore: false }));

      expect(result.current.needsLocalStoreSetup).toBe(true);
      expect(result.current.hasInvalidLocalStore).toBe(false);
      expect(setShowWizard).toHaveBeenCalledWith(true);
    });

    it("flags an invalid configured store as blocking (C1-C6)", () => {
      const { result } = render(makeStatus({ isValid: false }));

      expect(result.current.hasInvalidLocalStore).toBe(true);
      expect(result.current.needsLocalStoreSetup).toBe(false);
      expect(setShowWizard).not.toHaveBeenCalled();
    });

    it("routes an invalid env-override store to setup instead of blocking in test env", () => {
      const { result } = render(
        makeStatus({ isEnvironmentOverride: true, isValid: false }),
      );

      expect(result.current.needsLocalStoreSetup).toBe(true);
      expect(result.current.hasInvalidLocalStore).toBe(false);
    });

    it("flags critical environment errors", () => {
      const { result } = render(
        makeStatus({ isCriticalEnvironmentError: true }),
      );

      expect(result.current.hasCriticalEnvironmentError).toBe(true);
    });

    it("reports a valid configured store as fully healthy", () => {
      const { result } = render(makeStatus({}));

      expect(result.current.needsLocalStoreSetup).toBe(false);
      expect(result.current.hasInvalidLocalStore).toBe(false);
      expect(result.current.hasCriticalEnvironmentError).toBe(false);
    });
  });

  describe("environment banner", () => {
    it("shows on environment override and can be dismissed", () => {
      const { result } = render(makeStatus({ isEnvironmentOverride: true }));

      expect(result.current.showEnvironmentBanner).toBe(true);

      act(() => {
        result.current.dismissEnvironmentBanner();
      });

      expect(result.current.showEnvironmentBanner).toBe(false);
    });

    it("stays hidden without an override", () => {
      const { result } = render(makeStatus({}));

      expect(result.current.showEnvironmentBanner).toBe(false);
    });
  });

  describe("wizard lifecycle", () => {
    it("suppresses re-opening the wizard after a successful completion", async () => {
      const { rerender, result } = render(makeStatus({ hasLocalStore: false }));
      expect(setShowWizard).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.handleWizardSuccess();
      });

      expect(closeWizard).toHaveBeenCalledTimes(1);
      expect(refreshLocalStoreStatus).toHaveBeenCalledTimes(1);

      // Status still says "needs setup" until the refresh lands, but the
      // just-completed flag must prevent the auto-trigger from re-firing
      setShowWizard.mockClear();
      rerender({
        isInitialized: true,
        localStoreStatus: makeStatus({ hasLocalStore: false }),
      });
      expect(setShowWizard).not.toHaveBeenCalled();
    });

    it("re-arms the auto-trigger once setup is no longer needed", async () => {
      const { rerender, result } = render(makeStatus({ hasLocalStore: false }));

      await act(async () => {
        await result.current.handleWizardSuccess();
      });

      // Refresh lands: store is now valid, just-completed flag resets
      rerender({ isInitialized: true, localStoreStatus: makeStatus({}) });
      expect(result.current.needsLocalStoreSetup).toBe(false);

      // Store disappears again: wizard auto-opens once more
      setShowWizard.mockClear();
      rerender({
        isInitialized: true,
        localStoreStatus: makeStatus({ hasLocalStore: false }),
      });
      expect(setShowWizard).toHaveBeenCalledWith(true);
    });

    it("exposes the wizard-initializing flag", () => {
      const { result } = render(makeStatus({}));

      expect(result.current.isWizardInitializing).toBe(false);
      act(() => {
        result.current.setIsWizardInitializing(true);
      });
      expect(result.current.isWizardInitializing).toBe(true);
    });
  });

  describe("handleCriticalError", () => {
    it("closes the app via the electron API", () => {
      const { result } = render(
        makeStatus({ isCriticalEnvironmentError: true }),
      );

      act(() => {
        result.current.handleCriticalError();
      });

      expect(window.electronAPI.closeApp).toHaveBeenCalledTimes(1);
    });

    it("falls back to window.close without the electron API", () => {
      delete (window.electronAPI as { closeApp?: unknown }).closeApp;
      const windowCloseSpy = vi
        .spyOn(window, "close")
        .mockImplementation(() => {});

      const { result } = render(
        makeStatus({ isCriticalEnvironmentError: true }),
      );

      act(() => {
        result.current.handleCriticalError();
      });

      expect(windowCloseSpy).toHaveBeenCalledTimes(1);

      windowCloseSpy.mockRestore();
      // Rebuild the centralized mock to restore closeApp for later tests
      setupElectronAPIMock();
    });
  });
});
