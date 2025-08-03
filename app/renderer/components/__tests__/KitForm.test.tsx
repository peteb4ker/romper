// Test suite for KitForm component
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Kit } from "../../../../shared/db/schema";

import KitForm from "../KitForm";

afterEach(() => {
  cleanup();
});

describe("KitForm", () => {
  const baseKit = {
    alias: "My Kit",
  } as Kit;

  it("renders Edit Tags button when tagsEditable", () => {
    render(<KitForm kit={baseKit} onSave={vi.fn()} tagsEditable={true} />);
    expect(screen.getByText("Edit Tags")).toBeInTheDocument();
  });

  it("shows tag editing UI and allows adding tags", () => {
    const onSave = vi.fn();
    render(<KitForm kit={baseKit} onSave={onSave} tagsEditable={true} />);
    fireEvent.click(screen.getByText("Edit Tags"));
    // Add a tag
    const input = screen.getByPlaceholderText("Add tag");
    fireEvent.change(input, { target: { value: "kick" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Save
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("My Kit", "", ["kick"]);
  });

  it("shows loading and error states", () => {
    const { rerender } = render(
      <KitForm kit={baseKit} loading={true} onSave={vi.fn()} />,
    );
    expect(screen.getByText("Loading kit metadata...")).toBeInTheDocument();
    rerender(
      <KitForm error="Something went wrong" kit={baseKit} onSave={vi.fn()} />,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it('shows "No tags" if no tags present', () => {
    render(
      <KitForm
        kit={{ alias: "Empty" } as Kit}
        onSave={vi.fn()}
        tagsEditable={true}
      />,
    );
    expect(screen.getByText("No tags")).toBeInTheDocument();
  });
});
