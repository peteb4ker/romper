import {
  cleanup,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DRY: Common mock for useLocalStoreWizard
const getMockUseLocalStoreWizard = (overrides = {}) => ({
  state: { error: null, isInitializing: false, ...overrides.state },
  setTargetPath: vi.fn(),
  setSource: vi.fn(),
  setSdCardMounted: vi.fn(),
  setError: vi.fn(),
  setIsInitializing: vi.fn(),
  setSdCardPath: vi.fn(),
  validateSdCardFolder: vi.fn(),
  initialize: vi.fn(),
  defaultPath: "/mock/path/romper",
  progress: undefined,
  handleSourceSelect: vi.fn(),
  errorMessage: null,
  canInitialize: false,
  isSdCardSource: false,
  ...overrides,
});

let configMock = { sdCardPath: undefined };

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
  configMock = { sdCardPath: undefined };
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
          state: { error: "fail", isInitializing: false },
          errorMessage: "fail",
          canInitialize: true,
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
          state: { error: null, isInitializing: true },
          progress: { phase: "Downloading", percent: 42, file: "foo.zip" },
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
            source: null,
            targetPath: "",
            sdCardMounted: false,
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
          state: {
            error: null,
            isInitializing: false,
            source: "squarp",
            targetPath: "",
            sdCardMounted: false,
          },
          canInitialize: true,
        }),
    }));
    const { default: LocalStoreWizardUI } = await import(
      "../LocalStoreWizardUI"
    );
    render(<LocalStoreWizardUI onClose={() => {}} />);
    // The input should be present in step 2 (target selection)
    expect(screen.getByLabelText(/local store path/i)).toBeInTheDocument();
  });

  it("should auto-fill SD card path and not show picker when config.sdCardPath is set", async () => {
    configMock.sdCardPath = "/mock/sdcard";
    vi.doMock("../hooks/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () =>
        getMockUseLocalStoreWizard({
          state: {
            source: "sdcard",
            sourceConfirmed: false, // must be false so Source step is rendered
            sdCardPath: "/mock/sdcard",
            targetPath: "",
            isInitializing: false,
            error: null,
            sdCardMounted: true,
          },
          setSourceConfirmed: vi.fn(),
          setSdCardPath: vi.fn(),
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
