import { act, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BACKGROUND_FAILURE_MESSAGE } from "../utils/unhandledRejectionReporter";

vi.mock("../views/KitsView", () => ({
  default: () => <div data-testid="kits-view">KitsView</div>,
}));
vi.mock("../views/AboutView", () => ({
  default: () => <div data-testid="about-view">AboutView</div>,
}));
vi.mock("../components/StatusBar", () => ({
  default: () => <div data-testid="status-bar">StatusBar</div>,
}));
// main.tsx renders into #app when imported; the test renders App itself
vi.mock("react-dom/client", () => {
  const createRoot = vi.fn(() => ({ render: vi.fn() }));
  return { createRoot, default: { createRoot } };
});

// The window-level handler is wired to the app's toast stack (RE-92)
describe("[UC-36] a promise nobody caught reaches the message stack (RE-92)", () => {
  it("shows an error message", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { App } = await import("../main");
    render(<App />);

    const event = new Event("unhandledrejection", { cancelable: true });
    Object.defineProperty(event, "reason", {
      value: new Error("IPC channel closed"),
    });
    act(() => {
      globalThis.dispatchEvent(event);
    });

    expect(await screen.findByText(BACKGROUND_FAILURE_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/IPC channel closed/)).toBeNull();
    consoleError.mockRestore();
  });
});
