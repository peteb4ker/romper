import { afterEach, describe, expect, it } from "vitest";

import { installDocumentDropGuard } from "../documentDropGuard";

type FakeDataTransfer = { dropEffect: string };

function dragEvent(type: "dragover" | "drop") {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const dataTransfer: FakeDataTransfer = { dropEffect: "copy" };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return { dataTransfer, event };
}

describe("installDocumentDropGuard (RE-02)", () => {
  let remove: (() => void) | undefined;
  let zone: HTMLElement | undefined;

  afterEach(() => {
    remove?.();
    remove = undefined;
    zone?.remove();
    zone = undefined;
  });

  function addZone(
    handler: (event: Event) => void,
    type: "dragover" | "drop",
  ): HTMLElement {
    zone = document.createElement("div");
    zone.addEventListener(type, handler);
    document.body.appendChild(zone);
    return zone;
  }

  it("prevents the default for a drop outside any drop zone", () => {
    remove = installDocumentDropGuard();
    const { event } = dragEvent("drop");
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("marks an unhandled dragover as 'no drop'", () => {
    remove = installDocumentDropGuard();
    const { dataTransfer, event } = dragEvent("dragover");
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(dataTransfer.dropEffect).toBe("none");
  });

  it("leaves a dragover that a drop zone accepted alone", () => {
    remove = installDocumentDropGuard();
    const target = addZone((e) => {
      e.preventDefault();
      (
        e as unknown as { dataTransfer: FakeDataTransfer }
      ).dataTransfer.dropEffect = "copy";
    }, "dragover");
    const { dataTransfer, event } = dragEvent("dragover");
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(dataTransfer.dropEffect).toBe("copy");
  });

  it("does not stop propagation, so zones and later listeners still see events", () => {
    remove = installDocumentDropGuard();
    const seen: string[] = [];
    const target = addZone(() => seen.push("zone"), "drop");
    const windowListener = () => seen.push("window");
    window.addEventListener("drop", windowListener);
    try {
      target.dispatchEvent(dragEvent("drop").event);
    } finally {
      window.removeEventListener("drop", windowListener);
    }
    expect(seen).toEqual(["zone", "window"]);
  });

  it("does not interfere with a zone that stops propagation itself", () => {
    remove = installDocumentDropGuard();
    const target = addZone((e) => {
      e.preventDefault();
      e.stopPropagation();
    }, "drop");
    const { event } = dragEvent("drop");
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("removes its listeners when the returned cleanup runs", () => {
    installDocumentDropGuard()();
    const { event } = dragEvent("drop");
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
