import { waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../components/hooks/shared/useMessageDisplay", () => ({
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
  createRoot: createRootMock,
  default: { createRoot: createRootMock },
}));

// Document mock is now handled in vitest.setup.ts

describe("renderer/main.tsx", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renders the app with SettingsProvider and main layout", async () => {
    await import("../main");
    await waitFor(() => {
      expect(createRootMock).toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalled();
    });
    const [[element]] = renderMock.mock.calls;
    // Check that the SettingsProvider is the outermost provider
    expect(element.type.name).toBe("SettingsProvider");
    expect(element.props.children.type.name).toBe("App");
  });
});
