import * as matchers from "@testing-library/jest-dom/matchers";
import { TextEncoder } from "util";
import { beforeAll, expect, vi } from "vitest";

import { setupAudioMocks } from "./tests/mocks/browser/audio";
import { setupDOMMocks, setupWindowDOMMocks } from "./tests/mocks/browser/dom";
// Import centralized test infrastructure
import { defaultElectronAPIMock } from "./tests/mocks/electron/electronAPI";
import { defaultElectronFileAPIMock } from "./tests/mocks/electron/electronFileAPI";
// Import error handling mocks
import "./tests/mocks/errorHandling";

// Extend expect with testing-library matchers
expect.extend(matchers);

// Polyfill TextEncoder for Node.js environment
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}

// Setup global DOM mocks (IntersectionObserver, Document, Worker, Canvas)
setupDOMMocks();

// Setup window-specific mocks in beforeAll for proper lifecycle
beforeAll(() => {
  // Always ensure window object exists for tests
  globalThis.window = globalThis.window || {};

  // Setup Electron APIs
  window.electronAPI = defaultElectronAPIMock;
  window.electronFileAPI = defaultElectronFileAPIMock;

  // Mock URL.createObjectURL for Web Worker blob creation
  if (typeof globalThis.URL === "undefined") {
    globalThis.URL = {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    } as unknown;
  } else {
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
  }

  // Setup window-specific DOM mocks
  setupWindowDOMMocks();

  // Setup audio mocks
  setupAudioMocks();
});
