import type { Page } from "playwright";

import { expect } from "./e2e-error-guard";

/**
 * Opens the step sequencer and waits until it has taken focus. Opening it
 * focuses the grid from a timeout and from an animation frame, which comes
 * late in a hidden window; until both have run, the grid can take focus back
 * from a control the test focused, and a key meant for that control goes to
 * the grid instead (#560).
 */
export async function openSequencer(window: Page) {
  const handle = window.getByTestId("kit-step-sequencer-handle");
  await expect(handle).toBeVisible();
  if ((await handle.getAttribute("aria-label")) === "Show step sequencer") {
    await handle.click();
  }
  await expect(window.getByTestId("kit-step-sequencer-grid")).toBeFocused();
  // The grid's own frame has been queued since it opened, so it runs first
  await window.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0)),
      ),
  );
}
