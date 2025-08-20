import { vi } from "vitest";

/**
 * Centralized DOM mocks for tests
 * Provides consistent mock implementations for browser DOM APIs
 */

/**
 * Mock IntersectionObserver API
 * Returns a constructor function that creates mock instances
 */
export const createIntersectionObserverMock = () => {
  return vi.fn().mockImplementation((callback, options) => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    root: null,
    rootMargin: options?.rootMargin || "0px",
    thresholds: options?.threshold ? [options.threshold] : [0],
    unobserve: vi.fn(),
  }));
};

/**
 * Mock document object with common methods
 */
export const createDocumentMock = () => ({
  createElement: vi.fn(() => ({
    appendChild: vi.fn(),
    setAttribute: vi.fn(),
    style: {},
    type: "",
  })),
  createTextNode: vi.fn((text) => ({ nodeValue: text, textContent: text })),
  getElementById: vi.fn(() => document.createElement("div")),
  getElementsByTagName: vi.fn((tag) => {
    if (tag === "head") {
      return [{ appendChild: vi.fn(), insertBefore: vi.fn() }];
    }
    return [];
  }),
  head: {
    appendChild: vi.fn(),
    insertBefore: vi.fn(),
  },
});

/**
 * Mock HTMLCanvasElement.getContext with all required methods
 */
export const createCanvasContextMock = () => ({
  arc: vi.fn(),
  beginPath: vi.fn(),
  bezierCurveTo: vi.fn(),
  canvas: { height: 100, width: 100 },
  clearRect: vi.fn(),
  closePath: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  drawImage: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: "#000000",
  fillText: vi.fn(),
  font: "10px sans-serif",
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
  lineTo: vi.fn(),
  lineWidth: 1,
  moveTo: vi.fn(),
  putImageData: vi.fn(),
  quadraticCurveTo: vi.fn(),
  resetTransform: vi.fn(),
  restore: vi.fn(),
  rotate: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
  strokeStyle: "#000000",
  strokeText: vi.fn(),
  textAlign: "start",
  textBaseline: "alphabetic",
  translate: vi.fn(),
});

/**
 * Mock Worker for tests (step sequencer, etc.)
 */
export const createWorkerMock = () => {
  return class MockWorker {
    onmessage = null;
    constructor() {}
    postMessage(msg: unknown) {
      // Simulate immediate step event for sequencer tests
      if (msg.type === "START" && this.onmessage) {
        // Simulate a STEP event
        setTimeout(() => {
          this.onmessage({
            data: { payload: { currentStep: 0 }, type: "STEP" },
          });
        }, 1);
      }
    }
    terminate() {}
  };
};

/**
 * Setup all DOM mocks globally
 */
export const setupDOMMocks = () => {
  // IntersectionObserver - use Object.defineProperty for better compatibility
  const mockIntersectionObserver = createIntersectionObserverMock();
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: mockIntersectionObserver,
    writable: true,
  });
  global.IntersectionObserver = mockIntersectionObserver;

  // Document
  if (typeof global.document === "undefined") {
    global.document = createDocumentMock() as unknown;
  }

  // Worker
  if (typeof globalThis.Worker === "undefined") {
    globalThis.Worker = createWorkerMock() as unknown;
  }

  // HTMLCanvasElement.getContext
  if (typeof HTMLCanvasElement !== "undefined") {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: vi.fn(() => createCanvasContextMock()),
      writable: true,
    });
  }
};

/**
 * Setup window-specific DOM mocks
 */
export const setupWindowDOMMocks = () => {
  if (typeof window !== "undefined") {
    // IntersectionObserver on window - force override to ensure it's properly mocked
    window.IntersectionObserver = createIntersectionObserverMock();

    // HTMLElement.scrollIntoView
    if (typeof window.HTMLElement !== "undefined") {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  }
};
