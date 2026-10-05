import type { Kit } from "@romper/shared/db/schema";

// Test suite for KitForm component
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  describe("[Q-06] focus", () => {
    it("focuses the new-tag field when tag editing opens", () => {
      render(<KitForm kit={baseKit} onSave={vi.fn()} tagsEditable={true} />);
      const edit = screen.getByText("Edit Tags");
      edit.focus();

      fireEvent.click(edit);
      expect(screen.getByPlaceholderText("Add tag")).toHaveFocus();
    });

    it("leaves focus alone while tag editing stays open", () => {
      render(<KitForm kit={baseKit} onSave={vi.fn()} tagsEditable={true} />);
      fireEvent.click(screen.getByText("Edit Tags"));
      const input = screen.getByPlaceholderText("Add tag");
      fireEvent.change(input, { target: { value: "kick" } });
      fireEvent.keyDown(input, { key: "Enter" });
      const remove = screen.getByTitle("Remove tag");
      remove.focus();

      fireEvent.change(input, { target: { value: "snare" } });
      expect(remove).toHaveFocus();
    });

    it("focuses the field again when it reappears after loading", () => {
      const onSave = vi.fn();
      const { rerender } = render(
        <KitForm kit={baseKit} onSave={onSave} tagsEditable={true} />,
      );
      fireEvent.click(screen.getByText("Edit Tags"));
      rerender(
        <KitForm
          kit={baseKit}
          loading={true}
          onSave={onSave}
          tagsEditable={true}
        />,
      );
      expect(screen.queryByPlaceholderText("Add tag")).toBeNull();

      rerender(<KitForm kit={baseKit} onSave={onSave} tagsEditable={true} />);
      expect(screen.getByPlaceholderText("Add tag")).toHaveFocus();
    });
  });
});
