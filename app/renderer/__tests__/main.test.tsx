import { render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/settingsManager", () => ({
  applyTheme: vi.fn(),
}));

vi.mock("../utils/SettingsContext", () => ({
  SettingsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-provider">{children}</div>
  ),
}));

vi.mock("../views/KitsView", () => ({
  default: () => <div data-testid="kits-view">KitsView</div>,
}));

vi.mock("../views/AboutView", () => ({
  default: () => <div data-testid="about-view">AboutView</div>,
}));

vi.mock("../components/StatusBar", () => ({
  default: () => <div data-testid="status-bar">StatusBar</div>,
}));

vi.mock("../components/hooks/useMessageDisplay", () => ({
  useMessageDisplay: () => ({
    addMessage: vi.fn(),
    dismissMessage: vi.fn(),
    messages: [],
  }),
}));

vi.mock("../components/MessageDisplay", () => ({
  default: () => <div data-testid="message-display">MessageDisplay</div>,
}));

// Mock ReactDOM.createRoot
const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
vi.mock("react-dom/client", () => ({
  default: { createRoot: createRootMock },
  createRoot: createRootMock,
}));

// Document mock is now handled in vitest.setup.ts

describe("renderer/main.tsx", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls applyTheme on mount", async () => {
    const { applyTheme } = await import("../utils/settingsManager");
    // Actually render the App to trigger useEffect
    const { App } = await import("../main");
    render(<App />);
    await waitFor(() => {
      expect(applyTheme).toHaveBeenCalled();
    });
  });

  it("renders the app with SettingsProvider and main layout", async () => {
    await import("../main");
    await waitFor(() => {
      expect(createRootMock).toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalled();
    });
    const [[element]] = renderMock.mock.calls;
    // Check that the SettingsProvider is present
    expect(element.props.children.type.name).toBe("App");
  });
});
