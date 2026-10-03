/**
 * True while a modal dialog is open (`ModalDialog` marks its panel
 * `aria-modal="true"`). The kit browser's and kit editor's key handlers
 * listen on the window, so they check this and leave keys to the dialog:
 * a bank letter pressed in Preferences mustn't jump banks behind it (#500).
 */
export function isModalDialogOpen(doc: Document = document): boolean {
  return doc.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}
