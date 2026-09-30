import type { ElectronApplication } from "@playwright/test";

/**
 * Playwright can't click native dialogs. A target path typed into the setup
 * wizard makes main ask "Create your Romper local store in this folder?"
 * (RE-03), so e2e tests that type one answer "Use This Folder" by replacing
 * `dialog.showMessageBox` in the main process. The paths shown are recorded
 * so tests can assert the prompt appeared.
 */
export async function approveLocalStorePrompts(
  app: ElectronApplication,
): Promise<void> {
  await app.evaluate(({ dialog }) => {
    const shown: string[] = [];
    (globalThis as unknown as { __romperPrompts: string[] }).__romperPrompts =
      shown;
    dialog.showMessageBox = (async (...args: unknown[]) => {
      const options = (args.length > 1 ? args[1] : args[0]) as {
        detail?: string;
      };
      shown.push(options?.detail ?? "");
      return { checkboxChecked: false, response: 0 };
    }) as typeof dialog.showMessageBox;
  });
}

/** The folder paths main has asked the user to approve so far. */
export async function getLocalStorePromptsShown(
  app: ElectronApplication,
): Promise<string[]> {
  return app.evaluate(
    () =>
      (globalThis as unknown as { __romperPrompts?: string[] })
        .__romperPrompts ?? [],
  );
}
