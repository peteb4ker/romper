import type { Page } from "@playwright/test";

/** Drop real files on a voice the way a Finder/Explorer drop arrives */
export async function dropFiles(page: Page, voice: number, files: string[]) {
  await page.evaluate(() => {
    if (document.getElementById("e2e-drop-files")) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.id = "e2e-drop-files";
    input.style.display = "none";
    document.body.append(input);
  });
  // Files from a real file input carry their paths, so the preload's
  // webUtils.getPathForFile works as it does for an OS drop
  await page.setInputFiles("#e2e-drop-files", files);
  await page.evaluate((v) => {
    const input = document.getElementById("e2e-drop-files") as HTMLInputElement;
    const transfer = new DataTransfer();
    for (const file of Array.from(input.files ?? [])) transfer.items.add(file);
    const zone = document.querySelector(`[data-testid="drop-zone-voice-${v}"]`);
    if (!zone) throw new Error(`no drop zone for voice ${v}`);
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    }
  }, voice);
}
