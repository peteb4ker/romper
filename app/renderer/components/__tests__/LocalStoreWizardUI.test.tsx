import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DRY: Common mock for useLocalStoreWizard
const getMockUseLocalStoreWizard = (overrides = {}) => ({
  canInitialize: false,
  defaultPath: "/mock/path/romper",
  errorMessage: null,
  handleSourceSelect: vi.fn(),
  initialize: vi.fn(),
  isSdCardSource: false,
  progress: undefined,
  setError: vi.fn(),
  setIsInitializing: vi.fn(),
  setSdCardMounted: vi.fn(),
  setSdCardPath: vi.fn(),
  setSource: vi.fn(),
  setTargetPath: vi.fn(),
  state: { error: null, isInitializing: false, ...overrides.state },
  validateSdCardFolder: vi.fn(),
  ...overrides,
});

let configMock = { localStorePath: undefined };

beforeEach(() => {
  vi.resetModules();
  vi.doMock("../../config", async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      config: {
        ...actual.config,
        ...configMock,
      },
    };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  configMock = { localStorePath: undefined };
});

describe("LocalStoreWizardUI", () => {
  it("does not show progress bar if not initializing", async () => {
    vi.resetModules();
    vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () => getMockUseLocalStoreWizard(),
    }));
    const { default: LocalStoreWizardUI } =
      await import("../LocalStoreWizardUI");
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.queryByTestId("wizard-progress-bar")).toBeNull();
  });

  it("shows error message when error is present", async () => {
    vi.resetModules();
    const mockHook = getMockUseLocalStoreWizard({
      canInitialize: true,
      errorMessage: "fail",
      state: { error: "fail", isInitializing: false },
    });
    vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () => mockHook,
    }));
    const { default: LocalStoreWizardUI } =
      await import("../LocalStoreWizardUI");
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.getByTestId("wizard-error")).toHaveTextContent("fail");
  });

  it("shows progress bar when initializing", async () => {
    vi.resetModules();
    vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () =>
        getMockUseLocalStoreWizard({
          progress: { file: "foo.zip", percent: 42, phase: "Downloading" },
          state: { error: null, isInitializing: true },
        }),
    }));
    const { default: LocalStoreWizardUI } =
      await import("../LocalStoreWizardUI");
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.getByTestId("wizard-progress-bar")).toBeInTheDocument();
    expect(screen.getByText("Downloading")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-progress-file")).toHaveTextContent(
      "foo.zip",
    );
  });

  it("shows source selection first, hides target path input until source is selected", async () => {
    vi.resetModules();
    vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () =>
        getMockUseLocalStoreWizard({
          state: {
            error: null,
            isInitializing: false,
            sdCardMounted: false,
            source: null,
            targetPath: "",
          },
        }),
    }));
    const { default: LocalStoreWizardUI } =
      await import("../LocalStoreWizardUI");
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.getAllByText(/choose source/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/local store path/i)).toBeNull();
  });

  it("shows target path input after source is selected", async () => {
    vi.resetModules();
    vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () =>
        getMockUseLocalStoreWizard({
          canInitialize: true,
          state: {
            error: null,
            isInitializing: false,
            sdCardMounted: false,
            source: "squarp",
            targetPath: "",
          },
        }),
    }));
    const { default: LocalStoreWizardUI } =
      await import("../LocalStoreWizardUI");
    render(<LocalStoreWizardUI onClose={() => {}} />);
    // The input should be present in step 2 (target selection)
    expect(screen.getByLabelText(/local store path/i)).toBeInTheDocument();
  });

  it("should auto-fill SD card path and not show picker when config.localStorePath is set", async () => {
    configMock.localStorePath = "/mock/sdcard";
    vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () =>
        getMockUseLocalStoreWizard({
          setSdCardPath: vi.fn(),
          setSourceConfirmed: vi.fn(),
          state: {
            error: null,
            isInitializing: false,
            localStorePath: "/mock/sdcard",
            sdCardMounted: true,
            source: "sdcard",
            sourceConfirmed: false, // must be false so Source step is rendered
            targetPath: "",
          },
        }),
    }));
    const { default: LocalStoreWizardUI } =
      await import("../LocalStoreWizardUI");
    render(<LocalStoreWizardUI onClose={() => {}} />);
    // Should NOT show the SD card path display during the source step
    expect(screen.queryByTestId("wizard-sdcard-path-env")).toBeNull();
  });
  // RE-42: the notice comes from this run's result, not from wizard state
  // captured before the run (which never had the warnings)
  describe("[UC-01] [UC-02] after setup", () => {
    const readyToInitialize = (initialize: () => Promise<unknown>) =>
      getMockUseLocalStoreWizard({
        canInitialize: true,
        initialize,
        state: {
          error: null,
          isInitializing: false,
          source: "squarp",
          targetPath: "/tmp/store",
        },
      });

    it("names the samples left out when a voice had more than 12", async () => {
      vi.resetModules();
      const onSuccess = vi.fn();
      const mockHook = readyToInitialize(async () => ({
        success: true,
        truncationWarnings: [
          { kept: 12, kitName: "S62", skipped: 6, total: 18, voiceNumber: 2 },
        ],
      }));
      vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
        useLocalStoreWizard: () => mockHook,
      }));
      const { default: LocalStoreWizardUI } =
        await import("../LocalStoreWizardUI");
      render(<LocalStoreWizardUI onClose={() => {}} onSuccess={onSuccess} />);

      fireEvent.click(screen.getByTestId("wizard-initialize-btn"));

      const notice = await screen.findByTestId("truncation-warnings");
      expect(notice).toHaveTextContent("S62");
      expect(notice).toHaveTextContent("6 of 18 samples skipped");
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("[UC-01] lists what setup did with stereo voices (#537)", async () => {
      vi.resetModules();
      const onSuccess = vi.fn();
      const message =
        "Kit A0: voices 1 and 2 linked automatically as a stereo pair.";
      const mockHook = readyToInitialize(async () => ({
        stereoNotices: [{ kitName: "A0", message, voiceNumber: 1 }],
        success: true,
        truncationWarnings: [],
      }));
      vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
        useLocalStoreWizard: () => mockHook,
      }));
      const { default: LocalStoreWizardUI } =
        await import("../LocalStoreWizardUI");
      render(<LocalStoreWizardUI onClose={() => {}} onSuccess={onSuccess} />);

      fireEvent.click(screen.getByTestId("wizard-initialize-btn"));

      const summary = await screen.findByTestId("stereo-summary");
      expect(summary).toHaveTextContent(message);
      expect(screen.queryByTestId("truncation-warnings")).toBeNull();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("finishes straight away when nothing was left out", async () => {
      vi.resetModules();
      const onSuccess = vi.fn();
      const mockHook = readyToInitialize(async () => ({
        success: true,
        truncationWarnings: [],
      }));
      vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
        useLocalStoreWizard: () => mockHook,
      }));
      const { default: LocalStoreWizardUI } =
        await import("../LocalStoreWizardUI");
      render(<LocalStoreWizardUI onClose={() => {}} onSuccess={onSuccess} />);

      fireEvent.click(screen.getByTestId("wizard-initialize-btn"));

      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId("truncation-warnings")).toBeNull();
    });
  });
  // RE-66: Cancel during setup stops it, and the wizard closes only once
  // the work has stopped and been cleaned up
  describe("[UC-02] cancelling setup", () => {
    it("stops setup, shows it's stopping, then closes", async () => {
      vi.resetModules();
      const onClose = vi.fn();
      const cancelSetup = vi.fn(async () => {});
      const mockHook = getMockUseLocalStoreWizard({
        cancelSetup,
        state: {
          error: null,
          isInitializing: true,
          source: "squarp",
          targetPath: "/tmp/store",
        },
      });
      vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
        useLocalStoreWizard: () => mockHook,
      }));
      vi.spyOn(globalThis, "confirm").mockReturnValue(true);
      const { default: LocalStoreWizardUI } =
        await import("../LocalStoreWizardUI");
      const { rerender } = render(<LocalStoreWizardUI onClose={onClose} />);

      fireEvent.click(screen.getByTestId("wizard-cancel-btn"));

      expect(cancelSetup).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("wizard-cancel-btn")).toHaveTextContent(
        "Stopping",
      );
      expect(onClose).not.toHaveBeenCalled();

      // Setup has stopped. The component is memoised: a new prop stands in
      // for the hook's own state change re-rendering it
      mockHook.state = { ...mockHook.state, isInitializing: false };
      rerender(
        <LocalStoreWizardUI
          onClose={onClose}
          onInitializationChange={vi.fn()}
        />,
      );
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("keeps going when the user doesn't confirm", async () => {
      vi.resetModules();
      const onClose = vi.fn();
      const cancelSetup = vi.fn(async () => {});
      const mockHook = getMockUseLocalStoreWizard({
        cancelSetup,
        state: { error: null, isInitializing: true, source: "squarp" },
      });
      vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
        useLocalStoreWizard: () => mockHook,
      }));
      vi.spyOn(globalThis, "confirm").mockReturnValue(false);
      const { default: LocalStoreWizardUI } =
        await import("../LocalStoreWizardUI");
      render(<LocalStoreWizardUI onClose={onClose} />);

      fireEvent.click(screen.getByTestId("wizard-cancel-btn"));

      expect(cancelSetup).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("[UC-04] Choose Existing Store", () => {
    const renderWizard = async (setLocalStorePath = vi.fn()) => {
      vi.resetModules();
      vi.doMock("../hooks/wizard/useLocalStoreWizard", () => ({
        useLocalStoreWizard: () => getMockUseLocalStoreWizard(),
      }));
      const { default: LocalStoreWizardUI } =
        await import("../LocalStoreWizardUI");
      const onSuccess = vi.fn();
      render(
        <LocalStoreWizardUI
          onClose={() => {}}
          onSuccess={onSuccess}
          setLocalStorePath={setLocalStorePath}
        />,
      );
      fireEvent.click(screen.getByTestId("choose-existing-store-btn"));
      fireEvent.click(screen.getByTestId("browse-existing-store-btn"));
      return onSuccess;
    };

    it("opens the store once its path is saved", async () => {
      vi.mocked(
        globalThis.electronAPI.selectExistingLocalStore,
      ).mockResolvedValue({ error: null, path: "/store", success: true });
      const setLocalStorePath = vi.fn().mockResolvedValue(true);

      const onSuccess = await renderWizard(setLocalStorePath);

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(setLocalStorePath).toHaveBeenCalledWith("/store");
    });

    it("stays open and says why when the path can't be saved (RE-78)", async () => {
      vi.mocked(
        globalThis.electronAPI.selectExistingLocalStore,
      ).mockResolvedValue({ error: null, path: "/store", success: true });

      const onSuccess = await renderWizard(vi.fn().mockResolvedValue(false));

      expect(
        await screen.findByText(/Couldn't save the local store setting/),
      ).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("shows why main refused the folder", async () => {
      vi.mocked(
        globalThis.electronAPI.selectExistingLocalStore,
      ).mockResolvedValue({
        error: "Romper DB file not found",
        path: null,
        success: false,
      });
      const setLocalStorePath = vi.fn();

      const onSuccess = await renderWizard(setLocalStorePath);

      expect(
        await screen.findByText("Romper DB file not found"),
      ).toBeInTheDocument();
      expect(setLocalStorePath).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
