import fs from "fs-extra";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import {
  createBrokenKitStore,
  removeBrokenKitStore,
} from "../utils/broken-kit-store";
import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

// #812, stage 1 of docs/developer/store-check.md: main checks the store's
// sample files in the background once the kit grid has loaded, so a file
// deleted or broken on disk is found without opening its kit. A file Romper
// can't read shows the quarantine icon on the kit card; a file that's gone
// shows the badge, the status bar item and the one-time message (#824,
// stage 3).
test.describe("[UC-05] [Q-01] The store check finds broken sample files without opening the kit (#812)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  const indicator = (kit: string) =>
    window.locator(
      `[data-testid="kit-item-${kit}"] [data-testid="quarantine-indicator"]`,
    );
  const badge = (kit: string) =>
    window.locator(
      `[data-testid="kit-item-${kit}"] [data-testid="store-check-badge"]`,
    );

  /** What the store holds about a sample file, read while the app runs */
  function statusOf(kit: string, filename: string) {
    const db = new DatabaseSync(
      path.join(testEnv.localStorePath, ".romperdb", "romper.sqlite"),
      { readOnly: true },
    );
    try {
      const row = db
        .prepare(
          "SELECT source_status FROM samples WHERE kit_name = ? AND filename = ?",
        )
        .get(kit, filename) as { source_status: null | string } | undefined;
      return row?.source_status;
    } finally {
      db.close();
    }
  }

  test.beforeEach(async () => {
    // A0's snare is gone and B1's kick isn't a WAV any more
    testEnv = await createBrokenKitStore();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await removeBrokenKitStore(testEnv);
  });

  test("a file Romper can't read quarantines its kit's card, and a deleted file's row reads missing, with no kit opened", async () => {
    test.setTimeout(60000);

    // The check starts a few seconds after the grid loads
    await expect(indicator("B1")).toBeVisible({ timeout: 30000 });

    // A missing file doesn't quarantine its kit, and the card shows
    // nothing new for it
    await expect(indicator("A0")).toHaveCount(0);
    expect(statusOf("A0", "2_snare.wav")).toBe("missing");
    expect(statusOf("B1", "1_kick.wav")).toBe("unreadable");
    // The fine files were read once and recorded
    expect(statusOf("A0", "1_kick.wav")).toBe("readable");
  });

  test("a kit with a deleted file gets the badge, the status bar item and one message, and a kit with a file Romper can't read only the quarantine icon (#824)", async () => {
    test.setTimeout(60000);
    await expect(indicator("B1")).toBeVisible({ timeout: 30000 });

    // A0's snare is gone
    await expect(badge("A0")).toBeVisible();
    await expect(badge("A0")).toHaveAccessibleName("1 sample file not found");
    await expect(window.getByTestId("kit-item-A0")).toHaveAccessibleName(
      /1 sample file not found$/,
    );
    // B1's file can't be read: the quarantine icon only, and no other card
    await expect(badge("B1")).toHaveCount(0);
    await expect(
      window.locator('[data-testid="store-check-badge"]'),
    ).toHaveCount(1);

    const item = window.getByRole("button", { name: "1 kit needs attention" });
    await expect(item).toBeVisible();
    // One message, and it says where the list is
    const message = window.getByTestId("message-warning");
    await expect(message).toHaveCount(1);
    await expect(message).toHaveText(
      "Romper found missing sample files in 1 kit. Open the list from the status bar.",
    );
    await expect(message).toHaveAttribute("role", "status");
  });

  test("the status bar item opens the Library check, which lists the kit and closes with Escape, returning focus to the item (#824)", async () => {
    test.setTimeout(60000);
    const item = window.getByTestId("store-check-status");
    await expect(item).toBeVisible({ timeout: 30000 });

    await item.focus();
    await window.keyboard.press("Enter");

    const dialog = window.getByRole("dialog", { name: "Library check" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Sample files not found" }),
    ).toBeVisible();
    await expect(dialog.getByTestId("library-check-missing-A0")).toContainText(
      "1 sample file not found",
    );
    await expect(
      dialog.getByRole("heading", { name: "Files not in the kit" }),
    ).toHaveCount(0);
    // The kit that's only quarantined isn't a kit to look at here
    await expect(dialog.getByTestId("library-check-missing-B1")).toHaveCount(0);

    await window.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(item).toBeFocused();
  });
});

// #824: a store whose files all match says nothing at all
test.describe("[UC-05] [Q-01] The store check is silent when the library matches (#824)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await removeBrokenKitStore(testEnv);
  });

  test("shows no badge, no status bar item and no message once a pass has completed", async () => {
    test.setTimeout(60000);
    // The check starts a few seconds after the grid loads, and waits for a
    // quiet moment between kits, so ask rarely: every call is activity
    await expect
      .poll(
        async () =>
          window.evaluate(async () => {
            const api = (
              globalThis as unknown as {
                electronAPI: {
                  getStoreCheckStatus(): Promise<{
                    data?: { lastCompletedAt: null | number };
                  }>;
                };
              }
            ).electronAPI;
            return (await api.getStoreCheckStatus()).data?.lastCompletedAt;
          }),
        { intervals: [4000], timeout: 45000 },
      )
      .not.toBeNull();

    await expect(
      window.locator('[data-testid="store-check-badge"]'),
    ).toHaveCount(0);
    await expect(window.getByTestId("store-check-status")).toHaveCount(0);
    await expect(window.locator('[data-testid^="message-"]')).toHaveCount(0);
  });
});

// #824: samples on a drive that isn't connected are the drive's problem, not
// missing files: no badge, but the status bar item says so (approved on #824,
// 2026-10-31)
test.describe("[UC-05] [Q-06] A drive that isn't connected shows in the status bar and the Library check (#824)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  const volume = "/Volumes/RomperDriveThatIsNotThere";

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    // A0's samples are on a drive that isn't there. A0 is editable, as a kit
    // is whose samples you added from elsewhere: its folder isn't listed, so
    // the folder's own files aren't reported as not in the kit.
    const db = new DatabaseSync(
      path.join(testEnv.localStorePath, ".romperdb", "romper.sqlite"),
    );
    try {
      db.prepare(
        "UPDATE samples SET source_path = ? || '/' || filename WHERE kit_name = ?",
      ).run(volume, "A0");
      db.prepare("UPDATE kits SET editable = 1 WHERE name = ?").run("A0");
    } finally {
      db.close();
    }
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await removeBrokenKitStore(testEnv);
  });

  test("the item reads Drive not connected, opens the dialog with the drive's line, and no kit is badged or announced", async () => {
    test.setTimeout(60000);
    const item = window.getByRole("button", { name: "Drive not connected" });
    await expect(item).toBeVisible({ timeout: 40000 });
    await expect(
      window.locator('[data-testid="store-check-badge"]'),
    ).toHaveCount(0);
    await expect(window.locator('[data-testid^="message-"]')).toHaveCount(0);

    await item.click();

    const dialog = window.getByRole("dialog", { name: "Library check" });
    await expect(
      dialog.getByText(
        /^The drive "RomperDriveThatIsNotThere" isn't connected, so \d+ samples? in 1 kit (wasn't|weren't) checked\.$/,
      ),
    ).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveCount(0);
  });
});

// #820, stage 2: the folder side; #824, stage 3 shows it. The status main
// keeps is also read through the call the kit grid makes.
test.describe("[UC-05] [Q-01] The store check lists WAVs in a read-only kit's folder that no sample points at (#820)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    const store = testEnv.localStorePath;
    // B1 is read-only, as an imported kit is; A0 is editable
    const db = new DatabaseSync(path.join(store, ".romperdb", "romper.sqlite"));
    try {
      const editable = db.prepare(
        "UPDATE kits SET editable = ? WHERE name = ?",
      );
      editable.run(0, "B1");
      editable.run(1, "A0");
    } finally {
      db.close();
    }
    const wav = await fs.readFile(path.join(store, "A0", "1_kick.wav"));
    // A WAV dropped into each folder in Finder; a ._ file as macOS makes
    // beside files copied from a card
    await fs.writeFile(path.join(store, "B1", "4_dropped.wav"), wav);
    await fs.writeFile(
      path.join(store, "B1", "._4_dropped.wav"),
      "AppleDouble",
    );
    await fs.writeFile(path.join(store, "A0", "4_dropped.wav"), wav);
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await removeBrokenKitStore(testEnv);
  });

  test("finds the read-only kit's extra WAV, but not a ._ file or the editable kit's extra file", async () => {
    test.setTimeout(60000);
    type Status = {
      data?: {
        kits: {
          folderMissing: boolean;
          kitName: string;
          untracked: string[];
        }[];
        lastCompletedAt: null | number;
      };
    };
    const read = () =>
      window.evaluate(
        () =>
          (
            globalThis as unknown as {
              electronAPI: { getStoreCheckStatus(): Promise<unknown> };
            }
          ).electronAPI.getStoreCheckStatus() as Promise<Status>,
      );

    // The check starts a few seconds after the grid loads, and waits for a
    // quiet moment between kits, so ask rarely: every call is activity
    await expect
      .poll(async () => (await read()).data?.lastCompletedAt, {
        intervals: [4000],
        timeout: 45000,
      })
      .not.toBeNull();

    expect((await read()).data?.kits).toEqual([
      expect.objectContaining({
        folderMissing: false,
        kitName: "B1",
        untracked: ["4_dropped.wav"],
      }),
    ]);
  });

  test("[UC-05] Scan kit in the Library check adds the file, and the kit's badge, the status bar item and its entry go at once (#821)", async () => {
    test.setTimeout(60000);
    const badge = window.locator(
      '[data-testid="kit-item-B1"] [data-testid="store-check-badge"]',
    );
    const item = window.getByTestId("store-check-status");
    await expect(item).toBeVisible({ timeout: 40000 });
    await item.click();
    const dialog = window.getByRole("dialog", { name: "Library check" });
    const entry = dialog.getByTestId("library-check-untracked-B1");
    await expect(entry).toBeVisible();

    await entry.getByRole("button", { name: "Scan kit B1" }).click();

    // No new pass: main checks the kit again when the scan ends
    await expect(entry).toHaveCount(0);
    await expect(dialog.getByText("No problems found.")).toBeVisible();
    await expect(item).toHaveCount(0);
    await window.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(badge).toHaveCount(0);
    // The file is a sample of the kit now
    const db = new DatabaseSync(
      path.join(testEnv.localStorePath, ".romperdb", "romper.sqlite"),
      { readOnly: true },
    );
    try {
      const row = db
        .prepare("SELECT 1 AS found FROM samples WHERE source_path = ?")
        .get(path.join(testEnv.localStorePath, "B1", "4_dropped.wav"));
      expect(row).toBeTruthy();
    } finally {
      db.close();
    }
  });

  test("badges that kit and counts it in the status bar, with no message (there are no missing files) (#824)", async () => {
    test.setTimeout(60000);
    const badge = window.locator(
      '[data-testid="kit-item-B1"] [data-testid="store-check-badge"]',
    );
    await expect(badge).toBeVisible({ timeout: 40000 });
    await expect(badge).toHaveAccessibleName(
      "1 file in this kit's folder isn't in the kit. Scan the kit to add it.",
    );
    // A0 is editable: its extra file isn't reported
    await expect(
      window.locator(
        '[data-testid="kit-item-A0"] [data-testid="store-check-badge"]',
      ),
    ).toHaveCount(0);
    await expect(
      window.getByRole("button", { name: "1 kit needs attention" }),
    ).toBeVisible();
    await expect(window.locator('[data-testid^="message-"]')).toHaveCount(0);
  });
});

// #822, stage 5: "Remove missing samples" takes a kit's missing samples out
// in one step, from the Library check or the kit editor's notice, on a
// read-only kit too (D5), and one undo puts them back
test.describe("[UC-05] Remove missing samples (#822)", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  const snare = "2_snare.wav";

  const snareRows = () => {
    const db = new DatabaseSync(
      path.join(testEnv.localStorePath, ".romperdb", "romper.sqlite"),
      { readOnly: true },
    );
    try {
      return db
        .prepare(
          "SELECT voice_number, slot_number, source_status FROM samples WHERE kit_name = 'A0' AND filename = ?",
        )
        .all(snare);
    } finally {
      db.close();
    }
  };

  async function clickEditMenu(id: "redo" | "undo") {
    await electronApp.evaluate(({ BrowserWindow, Menu }, itemId) => {
      const target = BrowserWindow.getAllWindows()[0];
      const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
      if (!item) throw new Error(`no Edit menu item "${itemId}"`);
      item.click(undefined, target, target.webContents);
    }, id);
  }

  test.beforeEach(async () => {
    // A0's snare is gone; A0 is read-only, as an imported kit is
    testEnv = await createBrokenKitStore();
    const db = new DatabaseSync(
      path.join(testEnv.localStorePath, ".romperdb", "romper.sqlite"),
    );
    try {
      db.prepare("UPDATE kits SET editable = 0 WHERE name = 'A0'").run();
    } finally {
      db.close();
    }
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kit-grid"]', {
      timeout: 10000,
    });
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await removeBrokenKitStore(testEnv);
  });

  test("from the Library check: asks first, removes the read-only kit's missing sample, clears its badge at once, and Edit > Undo on the kit grid puts it back", async () => {
    test.setTimeout(60000);
    const badge = window.locator(
      '[data-testid="kit-item-A0"] [data-testid="store-check-badge"]',
    );
    const item = window.getByTestId("store-check-status");
    await expect(item).toBeVisible({ timeout: 40000 });
    const before = snareRows();
    expect(before).toEqual([
      expect.objectContaining({ source_status: "missing" }),
    ]);
    await item.click();
    const dialog = window.getByRole("dialog", { name: "Library check" });
    const entry = dialog.getByTestId("library-check-missing-A0");

    await entry
      .getByRole("button", { name: "Remove missing samples A0" })
      .click();
    const popover = dialog.getByRole("dialog", {
      name: "Remove 1 missing sample from A0? You can undo this.",
    });
    await expect(popover.getByRole("button", { name: "Cancel" })).toBeFocused();
    await popover
      .getByRole("button", { name: "Remove missing samples" })
      .click();

    // Main checks the kit again: the entry, the item and the badge go
    await expect(entry).toHaveCount(0);
    await expect(dialog.getByText("No problems found.")).toBeVisible();
    await expect(item).toHaveCount(0);
    expect(snareRows()).toEqual([]);
    await window.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(badge).toHaveCount(0);

    await clickEditMenu("undo");

    // The row is back where it was, and so is the badge
    await expect.poll(() => snareRows()).toEqual(before);
    await expect(badge).toBeVisible();
    await expect(
      window.getByRole("button", { name: "1 kit needs attention" }),
    ).toBeVisible();
  });

  test("from the kit editor's notice: removes it, and Edit > Undo in the read-only kit puts it back", async () => {
    test.setTimeout(60000);
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    const notice = window.getByTestId("kit-missing-files-notice");
    await expect(notice).toBeVisible({ timeout: 20000 });

    await notice
      .getByRole("button", { name: "Remove missing samples A0" })
      .click();
    await notice
      .getByRole("dialog", {
        name: "Remove 1 missing sample from A0? You can undo this.",
      })
      .getByRole("button", { name: "Remove missing samples" })
      .click();

    await expect(notice).toHaveCount(0);
    expect(snareRows()).toEqual([]);

    await clickEditMenu("undo");

    await expect(notice).toBeVisible();
    await expect(
      window.locator('[data-testid="sample-file-label-2-0"]'),
    ).toHaveText("File not found");
  });
});
