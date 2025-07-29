// Test suite for KitsView component
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Set up IntersectionObserver mock before any component imports
// This prevents race conditions with centralized mocks
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  root = null;
  rootMargin = "0px";
  thresholds = [0];

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin || "0px";
    this.thresholds = options?.threshold ? [options.threshold] : [0];
  }
}

globalThis.IntersectionObserver = MockIntersectionObserver as any;
if (typeof window !== "undefined") {
  window.IntersectionObserver = MockIntersectionObserver as any;
}

import KitsView from "../KitsView";
import { TestSettingsProvider } from "./TestSettingsProvider";

describe("KitsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Refresh the IntersectionObserver mock before each test
    globalThis.IntersectionObserver = MockIntersectionObserver as any;
    if (typeof window !== "undefined") {
      window.IntersectionObserver = MockIntersectionObserver as any;
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up DOM and reset modules
    cleanup();
  });
  it("renders KitBrowser with kits", async () => {
    render(
      <TestSettingsProvider>
        <KitsView />
      </TestSettingsProvider>,
    );
    // There may be multiple elements with the same kit label, so use findAllByText
    const kitA0s = await screen.findAllByText("A0");
    const kitA1s = await screen.findAllByText("A1");
    expect(kitA0s.length).toBeGreaterThan(0);
    expect(kitA1s.length).toBeGreaterThan(0);
  });
});
