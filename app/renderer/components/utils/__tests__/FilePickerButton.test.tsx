import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaFolder } from "react-icons/fa";
import { afterEach, describe, expect, it, vi } from "vitest";

import FilePickerButton from "../FilePickerButton";

describe("FilePickerButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders button with children text", () => {
    render(
      <FilePickerButton
        data-testid="file-picker"
        isSelecting={false}
        onClick={() => {}}
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker")).toHaveTextContent("Choose File");
  });

  it("shows selecting state with spinner and custom text", () => {
    render(
      <FilePickerButton
        data-testid="file-picker-selecting"
        isSelecting={true}
        onClick={() => {}}
        selectingText="Loading..."
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker-selecting")).toHaveTextContent(
      "Loading...",
    );
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("defaults to 'Selecting...' when no custom text provided", () => {
    render(
      <FilePickerButton
        data-testid="file-picker-default"
        isSelecting={true}
        onClick={() => {}}
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker-default")).toHaveTextContent(
      "Selecting...",
    );
  });

  it("shows icon when provided and not selecting", () => {
    render(
      <FilePickerButton
        data-testid="file-picker-with-icon"
        icon={<FaFolder data-testid="folder-icon" />}
        isSelecting={false}
        onClick={() => {}}
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("folder-icon")).toBeInTheDocument();
  });

  it("hides icon when selecting", () => {
    render(
      <FilePickerButton
        data-testid="file-picker-selecting-no-icon"
        icon={<FaFolder data-testid="folder-icon" />}
        isSelecting={true}
        onClick={() => {}}
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.queryByTestId("folder-icon")).not.toBeInTheDocument();
  });

  it("calls onClick when clicked and not disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <FilePickerButton
        data-testid="file-picker-clickable"
        isSelecting={false}
        onClick={onClick}
      >
        Choose File
      </FilePickerButton>,
    );

    await user.click(screen.getByTestId("file-picker-clickable"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when selecting", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <FilePickerButton
        data-testid="file-picker-disabled"
        isSelecting={true}
        onClick={onClick}
      >
        Choose File
      </FilePickerButton>,
    );

    await user.click(screen.getByTestId("file-picker-disabled"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <FilePickerButton
        data-testid="file-picker-explicitly-disabled"
        disabled={true}
        isSelecting={false}
        onClick={onClick}
      >
        Choose File
      </FilePickerButton>,
    );

    await user.click(screen.getByTestId("file-picker-explicitly-disabled"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is disabled when selecting or explicitly disabled", () => {
    const { rerender } = render(
      <FilePickerButton
        data-testid="file-picker-disabled-test"
        isSelecting={true}
        onClick={() => {}}
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker-disabled-test")).toBeDisabled();

    rerender(
      <FilePickerButton
        data-testid="file-picker-disabled-test"
        disabled={true}
        isSelecting={false}
        onClick={() => {}}
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker-disabled-test")).toBeDisabled();
  });

  it("applies custom className", () => {
    render(
      <FilePickerButton
        className="custom-class"
        data-testid="file-picker-custom-class"
        isSelecting={false}
        onClick={() => {}}
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker-custom-class")).toHaveClass(
      "custom-class",
    );
  });
});
