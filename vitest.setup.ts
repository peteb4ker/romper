import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { TextEncoder } from "node:util";
import { afterEach, beforeAll, vi } from "vitest";

import { clearSampleAudioCache } from "./app/renderer/utils/sampleAudioCache";
import { setupAudioMocks } from "./tests/mocks/browser/audio";
import { setupDOMMocks, setupWindowDOMMocks } from "./tests/mocks/browser/dom";
// Import centralized test infrastructure
import { defaultElectronAPIMock } from "./tests/mocks/electron/electronAPI";
import { defaultElectronFileAPIMock } from "./tests/mocks/electron/electronFileAPI";
// Import error handling mocks
import "./tests/mocks/errorHandling";

// Polyfill TextEncoder for Node.js environment
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}

// Unmount whatever each test rendered. Testing Library does this on its own
// only when Vitest's globals are on, and they aren't here. A component or
// hook left mounted keeps its listeners and timers, which can then handle
// the next test's events or fire after jsdom is gone (#704, #709). Test
// files' own afterEach hooks run first, so cleanup sees their teardown.
afterEach(cleanup);

// Decoded sample audio is cached for the session (#478); each test starts
// with none, so a test's mocks decide what a slot holds
afterEach(clearSampleAudioCache);

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
    } as unknown as typeof URL;
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
