import { afterEach, describe, expect, it } from "vitest";

import { isModalDialogOpen } from "../modalDialog";

describe("[UC-07] isModalDialogOpen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is false with no dialog", () => {
    expect(isModalDialogOpen()).toBe(false);
  });

  it("is true while a modal dialog is open", () => {
    document.body.innerHTML =
      '<div role="dialog" aria-modal="true" aria-label="Prefs"></div>';
    expect(isModalDialogOpen()).toBe(true);
  });

  // The step options and the shortcut overlay are dialogs, but not modal:
  // their own handlers keep their keys
  it("is false for a dialog that isn't modal", () => {
    document.body.innerHTML =
      '<div role="dialog" aria-label="Step options"></div>';
    expect(isModalDialogOpen()).toBe(false);
  });
});
