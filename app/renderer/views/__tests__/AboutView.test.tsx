// Test suite for AboutView component
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AboutView from "../AboutView";

afterEach(() => {
  cleanup();
});

describe("AboutView", () => {
  it("renders app name, version, and MIT license", () => {
    render(<AboutView />);
    expect(screen.getByText("Romper")).toBeInTheDocument();
    expect(screen.getByText(/Version:/)).toBeInTheDocument();
    expect(screen.getByText(/MIT license/)).toBeInTheDocument();
  });
  it("calls openExternal when GitHub button is clicked", () => {
    render(<AboutView />);
    const githubBtn = screen.getByText(/github.com\/peteb4ker\/romper/);
    fireEvent.click(githubBtn);
    expect(window.electronAPI.openExternal).toHaveBeenCalledWith(
      "https://github.com/peteb4ker/romper/"
    );
  });
  it("navigates back when Back button is clicked", () => {
    const navigate = vi.fn();
    render(<AboutView navigate={navigate} />);
    fireEvent.click(screen.getByText("← Back"));
    expect(navigate).toHaveBeenCalledWith("/kits");
  });
});
