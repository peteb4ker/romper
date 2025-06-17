import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("LocalStoreWizardUI", () => {
  it("does not show progress bar if not initializing", async () => {
    vi.resetModules();
    vi.doMock("../hooks/useLocalStoreWizard", () => ({
      useLocalStoreWizard: () => ({
        state: { error: null, isInitializing: false },
        setTargetPath: vi.fn(),
        setSource: vi.fn(),
        setSdCardMounted: vi.fn(),
        setError: vi.fn(),
        setIsInitializing: vi.fn(),
        initialize: vi.fn(),
        defaultPath: "/mock/path/romper",
        progress: undefined,
      }),
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
      useLocalStoreWizard: () => ({
        state: { error: "fail", isInitializing: false },
        setTargetPath: vi.fn(),
        setSource: vi.fn(),
        setSdCardMounted: vi.fn(),
        setError: vi.fn(),
        setIsInitializing: vi.fn(),
        initialize: vi.fn(),
        defaultPath: "/mock/path/romper",
        progress: null,
        handleSourceSelect: vi.fn(),
        errorMessage: "fail",
        canInitialize: true,
        isSdCardSource: false,
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
      useLocalStoreWizard: () => ({
        state: { error: null, isInitializing: true },
        setTargetPath: vi.fn(),
        setSource: vi.fn(),
        setSdCardMounted: vi.fn(),
        setError: vi.fn(),
        setIsInitializing: vi.fn(),
        initialize: vi.fn(),
        defaultPath: "/mock/path/romper",
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
      useLocalStoreWizard: () => ({
        state: {
          error: null,
          isInitializing: false,
          source: null,
          targetPath: "",
          sdCardMounted: false,
        },
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
      useLocalStoreWizard: () => ({
        state: {
          error: null,
          isInitializing: false,
          source: "squarp",
          targetPath: "/mock/path/romper",
          sdCardMounted: false,
        },
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
        canInitialize: true,
        isSdCardSource: false,
      }),
    }));
    const { default: LocalStoreWizardUI } = await import(
      "../LocalStoreWizardUI"
    );
    render(<LocalStoreWizardUI onClose={() => {}} />);
    expect(screen.getByLabelText(/local store path/i)).toBeInTheDocument();
  });
  // All tests below only verify UI rendering and user interaction, not IPC or Electron API
  // All hook return values are mocked, so no IPC is triggered
  // No test should depend on window.electronAPI or any real side effect
});
