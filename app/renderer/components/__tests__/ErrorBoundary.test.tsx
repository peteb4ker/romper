import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "../ErrorBoundary";

let shouldThrow = true;
function Flaky({ label = "content" }: { label?: string }) {
  if (shouldThrow) throw new Error("kit.voices is undefined");
  return <div>{label}</div>;
}

describe("ErrorBoundary (RE-12)", () => {
  beforeEach(() => {
    shouldThrow = true;
    // React reports caught render errors on the console too
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders its children when nothing fails", () => {
    shouldThrow = false;
    render(
      <ErrorBoundary area="Kit editor">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary")).not.toBeInTheDocument();
  });

  it("shows what failed instead of a blank window, and logs it", () => {
    render(
      <div>
        <p>status bar</p>
        <ErrorBoundary area="Kit editor">
          <Flaky />
        </ErrorBoundary>
      </div>,
    );

    const fallback = screen.getByTestId("error-boundary");
    expect(fallback).toHaveTextContent("Kit editor stopped working");
    expect(fallback).toHaveTextContent("kit.voices is undefined");
    // The rest of the window is still there
    expect(screen.getByText("status bar")).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Kit editor failed to render:"),
      expect.any(Error),
      expect.any(String),
    );
  });

  it("renders the children again on Try again", () => {
    render(
      <ErrorBoundary area="Kit list">
        <Flaky />
      </ErrorBoundary>,
    );
    shouldThrow = false;

    fireEvent.click(screen.getByTestId("error-boundary-retry"));

    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("offers a way back when there is one", () => {
    const onBack = vi.fn();
    render(
      <ErrorBoundary area="Kit editor" backLabel="Back to kits" onBack={onBack}>
        <Flaky />
      </ErrorBoundary>,
    );

    const back = screen.getByTestId("error-boundary-back");
    expect(back).toHaveTextContent("Back to kits");
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("has no back button without a way back", () => {
    render(
      <ErrorBoundary area="Kit list">
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.queryByTestId("error-boundary-back")).not.toBeInTheDocument();
  });

  it("tries again when its reset key changes, e.g. another kit is opened", () => {
    const { rerender } = render(
      <ErrorBoundary area="Kit editor" resetKey="A0">
        <Flaky label="A0" />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();

    shouldThrow = false;
    rerender(
      <ErrorBoundary area="Kit editor" resetKey="A1">
        <Flaky label="A1" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("A1")).toBeInTheDocument();
  });

  it("reloads the window on request", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...globalThis.location, reload });
    render(
      <ErrorBoundary area="Romper">
        <Flaky />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByTestId("error-boundary-reload"));

    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
