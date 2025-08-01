// Test suite for ThemeToggle component
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { TestSettingsProvider } from "../../views/__tests__/TestSettingsProvider";
import ThemeToggle from "../ThemeToggle";

afterEach(() => {
  cleanup();
});

describe("ThemeToggle", () => {
  it("renders the toggle button", () => {
    render(
      <TestSettingsProvider>
        <ThemeToggle />
      </TestSettingsProvider>,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("toggles dark mode when clicked", () => {
    render(
      <TestSettingsProvider>
        <ThemeToggle />
      </TestSettingsProvider>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Light Mode");
    fireEvent.click(button);
    // After click, should show 'Dark Mode'
    expect(button).toHaveTextContent("Dark Mode");
  });
});
