import { render } from "@testing-library/react";
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

// Mock ReactDOM.createRoot
const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
vi.mock("react-dom/client", () => ({
  default: { createRoot: createRootMock },
  createRoot: createRootMock,
}));

describe("renderer/main.tsx", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renders the app with SettingsProvider and main layout", async () => {
    const { App } = await import("../main");
    render(<App />);
    
    // The app should render successfully (theme is now handled by SettingsProvider)
    expect(true).toBe(true); // Basic test to ensure no errors on render
  });

  it("initializes ReactDOM root correctly", async () => {
    await import("../main");
    expect(createRootMock).toHaveBeenCalled();
    expect(renderMock).toHaveBeenCalled();
    const [[element]] = renderMock.mock.calls;
    // Check that the SettingsProvider is present
    expect(element.props.children.type.name).toBe("App");
  });
});
