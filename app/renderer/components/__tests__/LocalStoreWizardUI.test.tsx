import { cleanup, render, screen } from "@testing-library/react";
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
    vi.doMock("../hooks/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () => getMockUseLocalStoreWizard(),
    }));
    const { default: LocalStoreWizardUI } = await import(
      "../LocalStoreWizardUI"
    );
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.queryByTestId("wizard-progress-bar")).toBeNull();
  });

  it("shows error message when error is present", async () => {
    vi.resetModules();
    vi.doMock("../hooks/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () =>
        getMockUseLocalStoreWizard({
          canInitialize: true,
          errorMessage: "fail",
          state: { error: "fail", isInitializing: false },
        }),
    }));
    const { default: LocalStoreWizardUI } = await import(
      "../LocalStoreWizardUI"
    );
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.getByTestId("wizard-error")).toHaveTextContent("fail");
  });

  it("shows progress bar when initializing", async () => {
    vi.resetModules();
    vi.doMock("../hooks/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () =>
        getMockUseLocalStoreWizard({
          progress: { file: "foo.zip", percent: 42, phase: "Downloading" },
          state: { error: null, isInitializing: true },
        }),
    }));
    const { default: LocalStoreWizardUI } = await import(
      "../LocalStoreWizardUI"
    );
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.getByTestId("wizard-progress-bar")).toBeInTheDocument();
    expect(screen.getByText("Downloading")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-progress-file")).toHaveTextContent(
      "foo.zip",
    );
  });

  it("shows source selection first, hides target path input until source is selected", async () => {
    vi.resetModules();
    vi.doMock("../hooks/useLocalStoreWizard", () => ({
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
    const { default: LocalStoreWizardUI } = await import(
      "../LocalStoreWizardUI"
    );
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.getAllByText(/choose source/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/local store path/i)).toBeNull();
  });

  it("shows target path input after source is selected", async () => {
    vi.resetModules();
    vi.doMock("../hooks/useLocalStoreWizard", () => ({
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
    const { default: LocalStoreWizardUI } = await import(
      "../LocalStoreWizardUI"
    );
    render(<LocalStoreWizardUI onClose={() => {}} />);
    // The input should be present in step 2 (target selection)
    expect(screen.getByLabelText(/local store path/i)).toBeInTheDocument();
  });

  it("should auto-fill SD card path and not show picker when config.localStorePath is set", async () => {
    configMock.localStorePath = "/mock/sdcard";
    vi.doMock("../hooks/useLocalStoreWizard", () => ({
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
    const { default: LocalStoreWizardUI } = await import(
      "../LocalStoreWizardUI"
    );
    render(<LocalStoreWizardUI onClose={() => {}} />);
    // Should NOT show the SD card path display during the source step
    expect(screen.queryByTestId("wizard-sdcard-path-env")).toBeNull();
  });
});
