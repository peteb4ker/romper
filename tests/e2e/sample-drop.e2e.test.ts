import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "playwright";

import type { ElectronAPI } from "../../shared/electronApi";

import { appEnv } from "../utils/e2e-app-env";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";
import { encodeTestWav, sine } from "../validation/support/wav";

type ApiWindow = { electronAPI: ElectronAPI } & typeof globalThis;

// RE-74: dragging files over a filled slot used to say "Insert sample here
// (other samples will shift down)", but the drop always appends. The hint
// and highlight now show where the file will land.
test.describe("[UC-19] Dropping a file on a filled slot", () => {
  let electronApp: ElectronApplication;
  let window: Page;
  let testEnv: E2ETestEnvironment;
  let sourceDir: string;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-src-"));
    electronApp = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: appEnv(testEnv.environment),
      timeout: 30000,
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
    // Fixture kit A0 has a kick on voice 1
    await window.locator('[data-testid="kit-item-A0"]').click();
    await window.waitForSelector('[data-testid="kit-editor"]');
    await window.getByTitle("Enable editable mode").click();
    // Turning editing on refreshes the kit; wait for it to settle so the
    // refresh can't re-render the voice panel under the drag below
    await expect(window.getByTitle("Disable editable mode")).toBeVisible();
    await expect(
      window.locator('[data-testid="drop-zone-voice-1"]'),
    ).toBeVisible();
  });

  test.afterEach(async () => {
    await electronApp?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    if (sourceDir) await fs.rm(sourceDir, { force: true, recursive: true });
  });

  test("shows the slot it will land in, and lands there", async () => {
    const file = path.join(sourceDir, "1 snare.wav");
    await fs.writeFile(
      file,
      encodeTestWav([sine(200, 0.2, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    // A real file input, so the drop carries the file's path
    await window.evaluate(() => {
      const input = document.createElement("input");
      input.type = "file";
      input.id = "e2e-hover-file";
      input.style.display = "none";
      document.body.append(input);
    });
    await window.setInputFiles("#e2e-hover-file", [file]);

    const filled = window.getByRole("option", { name: /in slot 1$/ }).first();
    const dispatch = (types: string[]) =>
      filled.evaluate((slot, eventTypes) => {
        const input = document.getElementById(
          "e2e-hover-file",
        ) as HTMLInputElement;
        const transfer = new DataTransfer();
        for (const f of Array.from(input.files ?? [])) transfer.items.add(f);
        for (const type of eventTypes) {
          slot.dispatchEvent(
            new DragEvent(type, {
              bubbles: true,
              cancelable: true,
              dataTransfer: transfer,
            }),
          );
        }
      }, types);

    // Hovering the filled slot lights up the empty slot after it. A late
    // re-render can clear the hover, so hover again until it shows, as a
    // real drag keeps sending dragover
    await expect(async () => {
      await dispatch(["dragenter", "dragover"]);
      await expect(
        window.locator('[data-testid="drop-zone-voice-1"]'),
      ).toHaveAttribute("title", "Add sample to end of voice", {
        timeout: 1000,
      });
    }).toPass();
    await expect(window.locator('[title*="Insert sample here"]')).toHaveCount(
      0,
    );

    // And the file goes after the kick, not before it
    await dispatch(["drop"]);
    await expect
      .poll(
        () =>
          window.evaluate(async () => {
            const res = await (
              globalThis as unknown as ApiWindow
            ).electronAPI.getAllSamplesForKit("A0");
            return (res.data ?? [])
              .filter((s) => s.voice_number === 1)
              .sort((a, b) => a.slot_number - b.slot_number)
              .map((s) => s.filename);
          }),
        { timeout: 10000 },
      )
      .toEqual([expect.any(String), "1 snare.wav"]);
  });
});
