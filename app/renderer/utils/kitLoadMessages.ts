/**
 * The message for a kit whose samples couldn't be read, so the kit editor
 * says it the same way wherever the read fails. Approved on #605
 * and #628; reopening the kit tries again.
 */
export const samplesFailedMessage = (kitName: string): string =>
  `Couldn't load the samples for kit ${kitName}. Try reopening it.`;
