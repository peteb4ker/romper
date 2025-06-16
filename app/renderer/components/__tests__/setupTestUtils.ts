// Ensures @testing-library/react cleanup runs after each test for test isolation
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(() => {
  cleanup();
});
