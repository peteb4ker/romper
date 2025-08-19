import { vi } from "vitest";

/**
 * Centralized browser window API mocks
 * Reduces duplication across tests that need window object mocking
 */
export const createWindowMock = (overrides: Record<string, any> = {}) => ({
  // Events
  addEventListener: vi.fn(),

  blur: vi.fn(),

  clearInterval: vi.fn().mockImplementation(globalThis.clearInterval),

  clearTimeout: vi.fn().mockImplementation(globalThis.clearTimeout),

  // Console (for tests that need to mock console)
  console: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
  dispatchEvent: vi.fn(),
  // Focus/blur
  focus: vi.fn(),
  // History
  history: {
    back: vi.fn(),
    forward: vi.fn(),
    go: vi.fn(),
    length: 1,
    pushState: vi.fn(),
    replaceState: vi.fn(),
  },

  innerHeight: 768,
  // Dimensions
  innerWidth: 1024,
  // Storage
  localStorage: {
    clear: vi.fn(),
    getItem: vi.fn().mockReturnValue(null),
    key: vi.fn(),
    length: 0,
    removeItem: vi.fn(),
    setItem: vi.fn(),
  },

  // Location
  location: {
    assign: vi.fn(),
    hash: "",
    href: "http://localhost:3000",
    origin: "http://localhost:3000",
    pathname: "/",
    reload: vi.fn(),
    replace: vi.fn(),
    search: "",
  },
  outerHeight: 768,
  outerWidth: 1024,
  removeEventListener: vi.fn(),

  sessionStorage: {
    clear: vi.fn(),
    getItem: vi.fn().mockReturnValue(null),
    key: vi.fn(),
    length: 0,
    removeItem: vi.fn(),
    setItem: vi.fn(),
  },
  setInterval: vi.fn().mockImplementation(globalThis.setInterval),

  // Timers
  setTimeout: vi.fn().mockImplementation(globalThis.setTimeout),

  ...overrides,
});

/**
 * Centralized document API mocks
 */
export const createDocumentMock = (overrides: Record<string, any> = {}) => ({
  // Events
  addEventListener: vi.fn(),
  body: {
    appendChild: vi.fn(),
    classList: {
      add: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
      remove: vi.fn(),
    },
    removeChild: vi.fn(),
  },
  createDocumentFragment: vi.fn().mockReturnValue({
    appendChild: vi.fn(),
    children: [],
  }),
  // DOM creation
  createElement: vi.fn().mockImplementation((tagName: string) => ({
    addEventListener: vi.fn(),
    appendChild: vi.fn(),
    blur: vi.fn(),
    classList: {
      add: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
      remove: vi.fn(),
      toggle: vi.fn(),
    },
    click: vi.fn(),
    focus: vi.fn(),
    getAttribute: vi.fn().mockReturnValue(null),
    removeAttribute: vi.fn(),
    removeChild: vi.fn(),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn(),
    tagName: tagName.toUpperCase(),
  })),
  dispatchEvent: vi.fn(),

  // DOM querying
  getElementById: vi.fn().mockReturnValue(null),

  getElementsByClassName: vi.fn().mockReturnValue([]),

  getElementsByTagName: vi.fn().mockReturnValue([]),
  head: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
  querySelector: vi.fn().mockReturnValue(null),

  querySelectorAll: vi.fn().mockReturnValue([]),
  // Ready state
  readyState: "complete",
  removeEventListener: vi.fn(),

  // Document properties
  title: "Test Document",

  ...overrides,
});

/**
 * Sets up global window and document mocks for tests
 */
export const setupBrowserMocks = (
  windowOverrides: Record<string, any> = {},
  documentOverrides: Record<string, any> = {}
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

  return { document: documentMock, window: windowMock };
};
