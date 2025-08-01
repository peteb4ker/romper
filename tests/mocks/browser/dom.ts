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
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: options?.rootMargin || "0px",
    thresholds: options?.threshold ? [options.threshold] : [0],
  }));
};

/**
 * Mock document object with common methods
 */
export const createDocumentMock = () => ({
  getElementById: vi.fn(() => document.createElement("div")),
  getElementsByTagName: vi.fn((tag) => {
    if (tag === "head") {
      return [{ appendChild: vi.fn(), insertBefore: vi.fn() }];
    }
    return [];
  }),
  createElement: vi.fn(() => ({
    type: "",
    appendChild: vi.fn(),
    setAttribute: vi.fn(),
    style: {},
  })),
  createTextNode: vi.fn((text) => ({ nodeValue: text, textContent: text })),
  head: {
    appendChild: vi.fn(),
    insertBefore: vi.fn(),
  },
});

/**
 * Mock HTMLCanvasElement.getContext with all required methods
 */
export const createCanvasContextMock = () => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  drawImage: vi.fn(),
  canvas: { width: 100, height: 100 },
  fillStyle: "#000000",
  strokeStyle: "#000000",
  lineWidth: 1,
  font: "10px sans-serif",
  textAlign: "start",
  textBaseline: "alphabetic",
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
});

/**
 * Mock Worker for tests (step sequencer, etc.)
 */
export const createWorkerMock = () => {
  return class MockWorker {
    onmessage = null;
    constructor() {}
    postMessage(msg: any) {
      // Simulate immediate step event for sequencer tests
      if (msg.type === "START" && this.onmessage) {
        // Simulate a STEP event
        setTimeout(() => {
          this.onmessage({
            data: { type: "STEP", payload: { currentStep: 0 } },
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
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });
  global.IntersectionObserver = mockIntersectionObserver;

  // Document
  if (typeof global.document === "undefined") {
    global.document = createDocumentMock() as any;
  }

  // Worker
  if (typeof globalThis.Worker === "undefined") {
    globalThis.Worker = createWorkerMock() as any;
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
