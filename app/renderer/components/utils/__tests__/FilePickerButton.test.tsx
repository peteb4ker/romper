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
        isSelecting={false}
        onClick={() => {}}
        data-testid="file-picker"
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker")).toHaveTextContent("Choose File");
  });

  it("shows selecting state with spinner and custom text", () => {
    render(
      <FilePickerButton
        isSelecting={true}
        onClick={() => {}}
        selectingText="Loading..."
        data-testid="file-picker-selecting"
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
        isSelecting={true}
        onClick={() => {}}
        data-testid="file-picker-default"
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
        isSelecting={false}
        onClick={() => {}}
        icon={<FaFolder data-testid="folder-icon" />}
        data-testid="file-picker-with-icon"
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("folder-icon")).toBeInTheDocument();
  });

  it("hides icon when selecting", () => {
    render(
      <FilePickerButton
        isSelecting={true}
        onClick={() => {}}
        icon={<FaFolder data-testid="folder-icon" />}
        data-testid="file-picker-selecting-no-icon"
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
        isSelecting={false}
        onClick={onClick}
        data-testid="file-picker-clickable"
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
        isSelecting={true}
        onClick={onClick}
        data-testid="file-picker-disabled"
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
        isSelecting={false}
        onClick={onClick}
        disabled={true}
        data-testid="file-picker-explicitly-disabled"
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
        isSelecting={true}
        onClick={() => {}}
        data-testid="file-picker-disabled-test"
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker-disabled-test")).toBeDisabled();

    rerender(
      <FilePickerButton
        isSelecting={false}
        onClick={() => {}}
        disabled={true}
        data-testid="file-picker-disabled-test"
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker-disabled-test")).toBeDisabled();
  });

  it("applies custom className", () => {
    render(
      <FilePickerButton
        isSelecting={false}
        onClick={() => {}}
        className="custom-class"
        data-testid="file-picker-custom-class"
      >
        Choose File
      </FilePickerButton>,
    );

    expect(screen.getByTestId("file-picker-custom-class")).toHaveClass(
      "custom-class",
    );
  });
});
