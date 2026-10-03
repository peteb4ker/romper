import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SettingsContext,
  type SettingsContextProps,
} from "../../utils/SettingsContext";
import SampleDeleteButton from "../SampleDeleteButton";

function renderButton(
  confirmDestructiveActions: boolean | undefined,
  onRowClick = vi.fn(),
) {
  const onDelete = vi.fn();
  const button = (
    // The row the button sits in, as in the voice panel
    <div onClick={onRowClick} role="presentation">
      <SampleDeleteButton onDelete={onDelete} sampleName="kick.wav" />
    </div>
  );
  render(
    confirmDestructiveActions === undefined ? (
      button
    ) : (
      <SettingsContext.Provider
        value={{ confirmDestructiveActions } as SettingsContextProps}
      >
        {button}
      </SettingsContext.Provider>
    ),
  );
  return { onDelete, onRowClick };
}

describe("[UC-23] [UC-35] SampleDeleteButton (RE-44)", () => {
  afterEach(() => {
    cleanup();
  });

  it("deletes at once when Confirm destructive actions is off", () => {
    const { onDelete, onRowClick } = renderButton(false);

    fireEvent.click(screen.getByRole("button", { name: "Delete sample" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-delete-sample")).toBeNull();
  });

  it("asks first when it's on, and Cancel keeps the sample", () => {
    const { onDelete } = renderButton(true);

    fireEvent.click(screen.getByRole("button", { name: "Delete sample" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete kick.wav?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-delete-sample")).toBeNull();
  });

  it("deletes once confirmed, without selecting the row", () => {
    const { onDelete, onRowClick } = renderButton(true);

    fireEvent.click(screen.getByRole("button", { name: "Delete sample" }));
    fireEvent.click(screen.getByTestId("confirm-delete-sample-button"));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-delete-sample")).toBeNull();
  });

  it("asks first by default, with no settings loaded", () => {
    const { onDelete } = renderButton(undefined);

    fireEvent.click(screen.getByRole("button", { name: "Delete sample" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirm-delete-sample")).toBeInTheDocument();
  });
});
