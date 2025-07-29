import { vi } from "vitest";

/**
 * Centralized browser window API mocks
 * Reduces duplication across tests that need window object mocking
 */
export const createWindowMock = (overrides: Record<string, any> = {}) => ({
  // Location
  location: {
    href: "http://localhost:3000",
    origin: "http://localhost:3000",
    pathname: "/",
    search: "",
    hash: "",
    reload: vi.fn(),
    replace: vi.fn(),
    assign: vi.fn(),
  },

  // History
  history: {
    pushState: vi.fn(),
    replaceState: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    go: vi.fn(),
    length: 1,
  },

  // Storage
  localStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  },

  sessionStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  },

  // Timers
  setTimeout: vi.fn().mockImplementation(globalThis.setTimeout),
  clearTimeout: vi.fn().mockImplementation(globalThis.clearTimeout),
  setInterval: vi.fn().mockImplementation(globalThis.setInterval),
  clearInterval: vi.fn().mockImplementation(globalThis.clearInterval),

  // Events
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),

  // Dimensions
  innerWidth: 1024,
  innerHeight: 768,
  outerWidth: 1024,
  outerHeight: 768,

  // Focus/blur
  focus: vi.fn(),
  blur: vi.fn(),

  // Console (for tests that need to mock console)
  console: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },

  ...overrides,
});

/**
 * Centralized document API mocks
 */
export const createDocumentMock = (overrides: Record<string, any> = {}) => ({
  // DOM querying
  getElementById: vi.fn().mockReturnValue(null),
  querySelector: vi.fn().mockReturnValue(null),
  querySelectorAll: vi.fn().mockReturnValue([]),
  getElementsByClassName: vi.fn().mockReturnValue([]),
  getElementsByTagName: vi.fn().mockReturnValue([]),

  // DOM creation
  createElement: vi.fn().mockImplementation((tagName: string) => ({
    tagName: tagName.toUpperCase(),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
      toggle: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn().mockReturnValue(null),
    removeAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    click: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
  })),

  createDocumentFragment: vi.fn().mockReturnValue({
    appendChild: vi.fn(),
    children: [],
  }),

  // Document properties
  title: "Test Document",
  body: {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
    },
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
  head: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },

  // Events
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),

  // Ready state
  readyState: "complete",

  ...overrides,
});

/**
 * Sets up global window and document mocks for tests
 */
export const setupBrowserMocks = (
  windowOverrides: Record<string, any> = {},
  documentOverrides: Record<string, any> = {},
) => {
  const windowMock = createWindowMock(windowOverrides);
  const documentMock = createDocumentMock(documentOverrides);

  Object.defineProperty(globalThis, "window", {
    value: windowMock,
    writable: true,
  });

  Object.defineProperty(globalThis, "document", {
    value: documentMock,
    writable: true,
  });

  return { window: windowMock, document: documentMock };
};
