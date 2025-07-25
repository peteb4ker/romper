import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FaFolder } from "react-icons/fa";

import FilePickerButton from "../FilePickerButton";

describe("FilePickerButton", () => {
  it("renders button with children text", () => {
    render(
      <FilePickerButton isSelecting={false} onClick={() => {}}>
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.getByRole("button")).toHaveTextContent("Choose File");
  });

  it("shows selecting state with spinner and custom text", () => {
    render(
      <FilePickerButton 
        isSelecting={true} 
        onClick={() => {}} 
        selectingText="Loading..."
      >
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.getByRole("button")).toHaveTextContent("Loading...");
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("defaults to 'Selecting...' when no custom text provided", () => {
    render(
      <FilePickerButton isSelecting={true} onClick={() => {}}>
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.getByRole("button")).toHaveTextContent("Selecting...");
  });

  it("shows icon when provided and not selecting", () => {
    render(
      <FilePickerButton 
        isSelecting={false} 
        onClick={() => {}} 
        icon={<FaFolder data-testid="folder-icon" />}
      >
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.getByTestId("folder-icon")).toBeInTheDocument();
  });

  it("hides icon when selecting", () => {
    render(
      <FilePickerButton 
        isSelecting={true} 
        onClick={() => {}} 
        icon={<FaFolder data-testid="folder-icon" />}
      >
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.queryByTestId("folder-icon")).not.toBeInTheDocument();
  });

  it("calls onClick when clicked and not disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    
    render(
      <FilePickerButton isSelecting={false} onClick={onClick}>
        Choose File
      </FilePickerButton>
    );
    
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when selecting", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    
    render(
      <FilePickerButton isSelecting={true} onClick={onClick}>
        Choose File
      </FilePickerButton>
    );
    
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    
    render(
      <FilePickerButton isSelecting={false} onClick={onClick} disabled={true}>
        Choose File
      </FilePickerButton>
    );
    
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is disabled when selecting or explicitly disabled", () => {
    const { rerender } = render(
      <FilePickerButton isSelecting={true} onClick={() => {}}>
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.getByRole("button")).toBeDisabled();
    
    rerender(
      <FilePickerButton isSelecting={false} onClick={() => {}} disabled={true}>
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies custom className", () => {
    render(
      <FilePickerButton 
        isSelecting={false} 
        onClick={() => {}} 
        className="custom-class"
      >
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("applies test ID", () => {
    render(
      <FilePickerButton 
        isSelecting={false} 
        onClick={() => {}} 
        data-testid="file-picker"
      >
        Choose File
      </FilePickerButton>
    );
    
    expect(screen.getByTestId("file-picker")).toBeInTheDocument();
  });
});