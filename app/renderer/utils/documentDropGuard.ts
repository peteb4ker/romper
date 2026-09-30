/**
 * Stop the browser's default drag-and-drop behavior for drops that no app
 * drop zone handled (RE-02).
 *
 * Chromium's default for a file dropped outside a drop target is to navigate
 * the window to that file. The main process blocks the navigation too, but
 * this keeps a stray drop from ever trying.
 *
 * Coexisting with drop zones: the sample-slot zones call `preventDefault()`
 * and `stopPropagation()` in their own React handlers, which run before these
 * listeners (React listens on the root container, below `document` in the
 * bubble path), so events they handle never get here. These listeners only
 * call `preventDefault()`, never `stopPropagation()`, and only mark the
 * target as "no drop" when nothing earlier already accepted the drag.
 *
 * @returns a function that removes the listeners.
 */
export function installDocumentDropGuard(target: Document = document) {
  const onDragOver = (event: DragEvent) => {
    const handled = event.defaultPrevented;
    event.preventDefault();
    if (!handled && event.dataTransfer) {
      event.dataTransfer.dropEffect = "none";
    }
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
  };

  target.addEventListener("dragover", onDragOver);
  target.addEventListener("drop", onDrop);
  return () => {
    target.removeEventListener("dragover", onDragOver);
    target.removeEventListener("drop", onDrop);
  };
}
