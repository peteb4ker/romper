/** The user cancelled setup (RE-66). Not an error to show. */
export class SetupCancelledError extends Error {
  constructor() {
    super("Setup cancelled");
    this.name = "SetupCancelledError";
  }
}
